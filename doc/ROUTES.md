# 路由系统文档

## 路由概览

系统采用模块化路由设计，按功能分为三大模块：

```
/
├── /auth/*          # 认证模块
├── /api/*           # 业务模块
└── /system/*        # 系统模块
```

---

## 1. 认证路由 (auth.routes.ts)

**路径前缀**: `/auth`  
**文件位置**: `src/routes/auth.routes.ts`  
**依赖服务**: `StudentService`

### 1.1 路由列表

| 方法 | 路径 | 功能 | 速率限制 |
|------|------|------|---------|
| GET | /auth/captcha | 获取验证码 | 20/分钟 |
| POST | /auth/login | 用户登录 | 10/分钟 |
| POST | /auth/logout | 退出登录 | 无 |

### 1.2 实现细节

#### GET /auth/captcha

```typescript
/**
 * 功能流程:
 * 1. 生成 UUID Token
 * 2. 调用 StudentService.getCaptcha()
 * 3. 创建临时会话（SessionRepo.createTemp）
 * 4. 返回 sessionId 和验证码图片
 */
app.get('/auth/captcha', async (c) => {
    // 速率限制检查
    const clientIP = c.get('clientIP');
    if (!checkRateLimit(`captcha:${clientIP}`, CAPTCHA_RATE_LIMIT)) {
        return c.json({ code: 429, msg: "请求过于频繁" }, 429);
    }
    
    // 生成会话并获取验证码
    const sessionId = uuidv4();
    const service = new StudentService(sessionId);
    const { image } = await service.getCaptcha();
    
    return c.json({
        code: 200,
        data: { sessionId, image }
    });
});
```

**关键逻辑**:
- IP 级别速率限制
- 自动创建临时会话（存储 cookies 和 execution）
- Base64 格式返回验证码

---

#### POST /auth/login

```typescript
/**
 * 功能流程:
 * 1. 验证请求参数
 * 2. 调用 StudentService.login()
 * 3. 绑定学号到会话（SessionRepo.bindUser）
 * 4. 返回 Token
 */
app.post('/auth/login', async (c) => {
    // 参数验证
    const params = await c.req.json();
    const validation = validateLoginParams(params);
    if (!validation.valid) {
        return c.json({ code: 400, msg: validation.error }, 400);
    }
    
    // 速率限制
    const clientIP = c.get('clientIP');
    if (!checkRateLimit(`login:${clientIP}`, LOGIN_RATE_LIMIT)) {
        return c.json({ code: 429, msg: "请求过于频繁" }, 429);
    }
    
    // 执行登录
    const service = new StudentService(sessionId);
    const success = await service.login(username, password, code);
    
    if (success) {
        return c.json({ 
            code: 200, 
            msg: "登录成功", 
            token: sessionId 
        });
    } else {
        return c.json({ 
            code: 401, 
            msg: "学号、密码或验证码错误" 
        });
    }
});
```

**关键逻辑**:
- 参数格式验证（学号、密码长度等）
- IP + 时间窗口的速率限制
- 登录成功后更新会话状态（临时 → 活跃）
- 同时更新 users 表的 last_active_at

---

#### POST /auth/logout

```typescript
/**
 * 功能流程:
 * 1. 从 Header 获取 Token
 * 2. 删除会话（SessionRepo.delete）
 * 3. 返回成功响应
 */
app.post('/auth/logout', async (c) => {
    const token = c.req.header('Authorization');
    
    if (token && isValidTokenFormat(token)) {
        sessionRepo.delete(token);
        loggerInstance.info("用户退出登录", { token: maskToken(token) });
    }
    
    return c.json({ code: 200, msg: "退出成功" });
});
```

**关键逻辑**:
- 即使 Token 无效也返回成功（幂等性）
- 仅删除会话，不删除用户数据和缓存

---

## 2. 业务路由 (api.routes.ts)

**路径前缀**: `/api`  
**文件位置**: `src/routes/api.routes.ts`  
**依赖服务**: `StudentService`

### 2.1 路由列表

| 方法 | 路径 | 功能 | 缓存策略 | 强制刷新 |
|------|------|------|---------|---------|
| GET | /api/grades | 获取成绩单 | 12 小时 | ✅ |
| GET | /api/schedule | 获取课表 | 动态TTL（周一过期） | ✅ |
| GET | /api/ecard | 获取一卡通 | 无缓存 | ❌ |
| GET | /api/user | 获取用户信息 | 30天 | ✅ |

### 2.2 认证中间件

所有业务路由都经过统一的认证中间件：

```typescript
/**
 * 认证中间件
 * 验证 Token 格式和会话有效性
 */
async function authMiddleware(c, next) {
    const token = c.req.header('Authorization');
    
    // 1. Token 格式验证
    if (!token || !isValidTokenFormat(token)) {
        return c.json({ code: 401, msg: "Token 无效" }, 401);
    }
    
    // 2. 会话查询
    const session = sessionRepo.get(token);
    if (!session || !session.student_id) {
        return c.json({ code: 401, msg: "请先登录" }, 401);
    }
    
    // 3. 速率限制
    const userId = session.student_id;
    if (!checkRateLimit(`api:${userId}`, API_RATE_LIMIT)) {
        return c.json({ code: 429, msg: "请求过于频繁" }, 429);
    }
    
    // 4. 设置上下文
    c.set('userId', userId);
    await next();
}
```

**关键检查**:
- Token 格式（UUID v4）
- 会话是否存在且已登录
- 用户级别速率限制

---

### 2.3 实现细节

#### GET /api/schedule

```typescript
/**
 * 功能流程:
 * 1. 检查缓存（基于本周一零点）
 * 2. 缓存命中直接返回
 * 3. 缓存未命中则从学校获取
 * 4. 保存缓存并返回
 */
app.get('/api/schedule', authMiddleware, async (c) => {
    const token = c.req.header('Authorization')!;
    const refresh = c.req.query('refresh') === 'true';
    
    const service = new StudentService(token);
    const result = await service.getSchedule(refresh);
    
    return c.json({
        code: 200,
        data: {
            ...result.data,
            _source: result.source  // 'cache' 或 'network'
        }
    });
});
```

**缓存逻辑**:
```typescript
// 判断是否过期
const thisMonday = getThisMonday();  // 本周一 00:00
const isExpired = updatedAt < thisMonday;

// 如果未过期且不强制刷新，返回缓存
if (!isExpired && !forceRefresh) {
    return cachedData;
}
```

**错误处理**:
- Cookie 失效 → 返回 401，删除会话
- 学校系统异常 → 返回 500
- 解析失败 → 返回 500

---

#### GET /api/ecard

```typescript
/**
 * 功能流程:
 * 1. 直接从学校实时获取（无缓存）
 * 2. 解析余额和状态
 * 3. 返回数据
 */
app.get('/api/ecard', authMiddleware, async (c) => {
    const token = c.req.header('Authorization')!;
    
    const service = new StudentService(token);
    const result = await service.getECard();
    
    return c.json({
        code: 200,
        data: {
            ...result.data,
            _source: 'network'  // 总是实时
        }
    });
});
```

**特殊说明**:
- 一卡通数据实时性要求高，不缓存
- 每次请求都会发起网络请求

---

#### GET /api/user

```typescript
/**
 * 功能流程:
 * 1. 检查缓存（TTL: 30天）
 * 2. 缓存命中直接返回
 * 3. 缓存未命中则从学校获取
 * 4. 同步到 users 表（UserRepo.saveProfile）
 * 5. 保存缓存并返回
 */
app.get('/api/user', authMiddleware, async (c) => {
    const token = c.req.header('Authorization')!;
    const refresh = c.req.query('refresh') === 'true';
    
    const service = new StudentService(token);
    const result = await service.getUserInfo(refresh);
    
    return c.json({
        code: 200,
        data: {
            ...result.data,
            _source: result.source
        }
    });
});
```

**特殊处理**:
- 获取成功后同步到 users 表（结构化存储）
- 长期缓存（学籍信息变动少）

---

## 3. 系统路由 (system.routes.ts)

**路径前缀**: `/system`  
**文件位置**: `src/routes/system.routes.ts`  
**依赖服务**: `StatsRepo`

### 3.1 路由列表

| 方法 | 路径 | 功能 | 鉴权 |
|------|------|------|------|
| GET | /system/health | 健康检查 | ❌ |
| GET | /system/stats | 系统统计 | ❌ |
| GET | /system/stats/users | 用户统计 | ❌ |
| GET | /system/stats/sessions | 会话统计 | ❌ |
| GET | /system/stats/cache | 缓存统计 | ❌ |
| GET | /system/stats/active-users | 活跃排行 | ❌ |

### 3.2 实现细节

#### GET /system/health

```typescript
/**
 * 健康检查端点
 * 用于负载均衡器和监控系统
 */
app.get('/system/health', (c) => {
    return c.json({
        code: 200,
        data: {
            status: 'healthy',
            timestamp: Date.now(),
            uptime: process.uptime()  // 运行时长（秒）
        }
    });
});
```

**用途**:
- 负载均衡器健康探测
- 监控系统可用性检查
- 部署验证

---

#### GET /system/stats

```typescript
/**
 * 系统完整统计
 * 返回用户、会话、缓存的全量统计数据
 */
app.get('/system/stats', (c) => {
    const stats = statsRepo.getSystemStats();
    
    return c.json({
        code: 200,
        data: stats
    });
});
```

**返回数据结构**:
```json
{
  "user": {
    "totalUsers": 1250,
    "activeUsersToday": 85,
    "activeUsersWeek": 320,
    "activeUsersMonth": 890,
    "newUsersToday": 0,     // 待实现
    "newUsersWeek": 0,      // 待实现
    "newUsersMonth": 0      // 待实现
  },
  "session": {
    "totalSessions": 1580,
    "activeSessions": 1450,
    "tempSessions": 130,
    "multiDeviceUsers": 245
  },
  "cache": {
    "totalCacheRecords": 3750,
    "scheduleCache": 1250,
    "ecardCache": 1250,
    "userInfoCache": 1250
  },
  "timestamp": 1702195825000
}
```

---

#### GET /system/stats/users

```typescript
/**
 * 用户维度统计
 * 基于 users 表的 last_active_at 字段
 */
app.get('/system/stats/users', (c) => {
    const stats = statsRepo.getUserStats();
    return c.json({ code: 200, data: stats });
});
```

**SQL 查询示例**:
```sql
-- 今日活跃
SELECT COUNT(*) FROM users 
WHERE last_active_at >= ?  -- 24小时前

-- 周活跃
SELECT COUNT(*) FROM users 
WHERE last_active_at >= ?  -- 7天前

-- 月活跃
SELECT COUNT(*) FROM users 
WHERE last_active_at >= ?  -- 30天前
```

---

#### GET /system/stats/sessions

```typescript
/**
 * 会话维度统计
 * 分析会话状态分布
 */
app.get('/system/stats/sessions', (c) => {
    const stats = statsRepo.getSessionStats();
    return c.json({ code: 200, data: stats });
});
```

**关键指标**:
- `totalSessions`: 总会话数
- `activeSessions`: 已登录会话（student_id 非空）
- `tempSessions`: 临时会话（student_id 为空）
- `multiDeviceUsers`: 多设备用户数（同一学号多个 Token）

---

#### GET /system/stats/cache

```typescript
/**
 * 缓存维度统计
 * 按类型统计缓存记录数
 */
app.get('/system/stats/cache', (c) => {
    const stats = statsRepo.getCacheStats();
    return c.json({ code: 200, data: stats });
});
```

**SQL 查询示例**:
```sql
-- 课表缓存数
SELECT COUNT(*) FROM data_cache WHERE type = 'SCHEDULE'

-- 一卡通缓存数
SELECT COUNT(*) FROM data_cache WHERE type = 'ECARD'

-- 用户信息缓存数
SELECT COUNT(*) FROM data_cache WHERE type = 'USER_INFO'
```

---

#### GET /system/stats/active-users

```typescript
/**
 * 活跃用户排行榜
 * 按最后活跃时间降序排列
 */
app.get('/system/stats/active-users', (c) => {
    const limit = parseInt(c.req.query('limit') || '10');
    const ranking = statsRepo.getActiveUsersRanking(limit);
    
    return c.json({ code: 200, data: ranking });
});
```

**SQL 查询**:
```sql
SELECT student_id, name, last_active_at 
FROM users 
WHERE last_active_at IS NOT NULL 
ORDER BY last_active_at DESC 
LIMIT ?
```

---

## 4. 静态资源路由

**路径**: `/`  
**文件位置**: `src/server.ts`  

```typescript
/**
 * 首页
 * 返回 index.html
 */
app.get('/', async (c) => {
    try {
        const file = Bun.file('./index.html');
        const html = await file.text();
        return c.html(html);
    } catch {
        return c.text('页面不存在', 404);
    }
});
```

---

## 5. 路由注册流程

### 5.1 注册顺序

```typescript
// src/server.ts

// 1. 全局中间件
app.use('/*', cors(...));
app.use('*', createPerformanceMiddleware());

// 2. 业务路由
registerApiRoutes(app);      // /api/*
registerAuthRoutes(app);     // /auth/*

// 3. 系统路由
app.route('/', systemRoutes); // /system/*

// 4. 静态资源（兜底）
app.get('/', ...);
```

**注意事项**:
- 中间件在所有路由之前注册
- 系统路由使用 `app.route()` 挂载子路由
- 静态资源路由放在最后（避免覆盖其他路由）

---

## 6. 中间件链

### 6.1 全局中间件

```
请求 → CORS → 性能监控 → 路由匹配 → 响应
```

**CORS 中间件**:
- 开发环境: 允许所有来源
- 生产环境: 限制 CORS_ORIGINS 环境变量

**性能监控中间件**:
- 记录请求开始时间
- 提取客户端 IP（优先 X-Forwarded-For）
- 记录响应时间和状态码
- 统计 QPS 和延迟

### 6.2 业务中间件

```
请求 → 认证中间件 → 速率限制 → 业务逻辑 → 响应
```

**认证中间件** (`authMiddleware`):
1. Token 格式验证
2. 会话有效性检查
3. 速率限制检查
4. 设置上下文变量（userId）

---

## 7. 错误处理

### 7.1 统一错误格式

```json
{
  "code": 401,
  "msg": "错误描述"
}
```

### 7.2 错误类型

| 错误码 | 场景 | 处理建议 |
|--------|------|---------|
| 400 | 参数错误 | 检查请求参数格式 |
| 401 | 未授权 | 清除 Token，跳转登录 |
| 429 | 速率限制 | 延迟重试 |
| 500 | 服务器错误 | 提示"服务繁忙" |

### 7.3 特殊错误处理

**SessionExpiredError**:
```typescript
catch (e) {
    if (e instanceof SessionExpiredError) {
        // 自动删除会话
        sessionRepo.delete(token);
        return c.json({ code: 401, msg: "请先登录" }, 401);
    }
}
```

---

## 8. 日志记录

### 8.1 路由级别日志

```typescript
// 请求开始
loggerInstance.info("用户尝试登录", { 
    username: maskStudentId(username), 
    sessionId: maskToken(sessionId) 
});

// 请求成功
loggerInstance.info("用户登录成功", { 
    username: maskStudentId(username) 
});

// 请求失败
loggerInstance.warn("用户登录失败", { 
    username: maskStudentId(username) 
});
```

### 8.2 敏感信息脱敏

- Token: `550e8400-****`
- 学号: `2024****1`
- 密码: 不记录

---

## 9. 测试建议

### 9.1 单元测试

```typescript
// 测试路由处理器
describe('Auth Routes', () => {
    test('获取验证码应返回 sessionId 和 image', async () => {
        const res = await app.request('/auth/captcha');
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.data.sessionId).toBeDefined();
        expect(json.data.image).toMatch(/^data:image/);
    });
});
```

### 9.2 集成测试

```typescript
// 测试完整登录流程
test('完整登录流程', async () => {
    // 1. 获取验证码
    const captchaRes = await app.request('/auth/captcha');
    const { sessionId } = (await captchaRes.json()).data;
    
    // 2. 模拟登录（需要 mock 学校接口）
    const loginRes = await app.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            sessionId,
            username: 'test_user',
            password: 'test_pass',
            code: 'test_code'
        })
    });
    
    expect(loginRes.status).toBe(200);
});
```

---

## 10. 性能优化建议

### 10.1 缓存优化
- ✅ 课表使用智能 TTL（周一过期）
- ✅ 用户信息长期缓存（30天）
- ❌ 一卡通无缓存（实时性要求）

### 10.2 数据库优化
- ✅ 索引覆盖常用查询
- ✅ Prepared Statements 复用
- ✅ WAL 模式提升并发

### 10.3 网络优化
- ✅ Connection Keep-Alive
- ✅ 复用 CookieJar
- ✅ 请求超时控制

---

## 附录

### A. 路由快速参考

```
认证
├── GET  /auth/captcha       获取验证码
├── POST /auth/login         用户登录
└── POST /auth/logout        退出登录

业务
├── GET  /api/schedule       获取课表
├── GET  /api/ecard          获取一卡通
└── GET  /api/user           获取用户信息

系统
├── GET  /system/health                 健康检查
├── GET  /system/stats                  系统统计
├── GET  /system/stats/users            用户统计
├── GET  /system/stats/sessions         会话统计
├── GET  /system/stats/cache            缓存统计
└── GET  /system/stats/active-users     活跃排行
```

### B. 中间件执行顺序

```
1. CORS 中间件（全局）
2. 性能监控中间件（全局）
3. 认证中间件（业务路由）
4. 路由处理器
5. 错误处理
6. 响应返回
```

### C. 速率限制配置

| 接口 | 限制 | 环境变量 |
|------|------|---------|
| 验证码 | 20/分钟 | CAPTCHA_RATE_LIMIT |
| 登录 | 10/分钟 | LOGIN_RATE_LIMIT |
| 业务 API | 60/分钟 | API_RATE_LIMIT |
