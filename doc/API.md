# API 接口文档

## 基础信息

- **Base URL**: 
  - 开发环境：`http://localhost:3000`
  - 生产环境：`http://localhost:12103`（或实际域名）
- **协议**: HTTP/HTTPS
- **数据格式**: JSON

## 通用响应格式

### 成功响应
```json
{
  "code": 200,
  "data": { /* 业务数据 */ },
  "msg": "操作成功"  // 可选
}
```

### 错误响应
```json
{
  "code": 401,  // 或其他错误码
  "msg": "错误信息描述"
}
```

### 状态码说明
| 状态码 | 说明 | 场景 |
|--------|------|------|
| 200 | 成功 | 请求正常处理 |
| 400 | 请求参数错误 | 参数格式不正确或缺失 |
| 401 | 未授权 | Token 无效或已过期 |
| 403 | 禁止访问 | 权限不足（如非管理员访问管理接口） |
| 429 | 请求过于频繁 | 触发速率限制 |
| 500 | 服务器错误 | 服务器内部错误 |

---

## 1. 认证模块 (Auth)

### 1.1 获取验证码

**接口**: `GET /auth/captcha`

**描述**: 创建临时会话并返回登录验证码

**请求参数**: 无

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  }
}
```

**字段说明**:
- `sessionId`: 临时会话 Token（UUID v4 格式）
- `image`: Base64 编码的验证码图片（可直接用于 `<img>` 标签）

**注意事项**:
- 验证码有效期为 10 分钟
- 超过有效期的 sessionId 将被自动清理
- 速率限制：20 次/分钟

---

### 1.2 用户登录

**接口**: `POST /auth/login`

**描述**: 使用学号、密码和验证码登录

**请求头**:
```
Content-Type: application/json
```

**请求体**:
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "username": "202401001",
  "password": "yourpassword",
  "code": "ab3d"
}
```

**字段说明**:
- `sessionId`: 从获取验证码接口返回的会话 ID
- `username`: 学号
- `password`: 教务系统密码
- `code`: 验证码（忽略大小写）

**成功响应**:
```json
{
  "code": 200,
  "msg": "登录成功",
  "token": "550e8400-e29b-41d4-a716-446655440000"
}
```

**失败响应**:
```json
{
  "code": 401,
  "msg": "学号、密码或验证码错误"
}
```

**注意事项**:
- 登录成功后 `token` 即为认证凭证，请妥善保存
- Token 无固定过期时间，90 天未活跃自动失效
- 速率限制：10 次/分钟

---

### 1.3 退出登录

**接口**: `POST /auth/logout`

**描述**: 销毁服务端会话

**请求头**:
```
Authorization: <token>
```

**请求参数**: 无

**成功响应**:
```json
{
  "code": 200,
  "msg": "退出成功"
}
```

**注意事项**:
- 退出后 Token 立即失效
- 即使不提供 Token 也返回成功

---

## 2. 业务模块 (API)

所有业务接口需要在请求头中携带 Token：
```
Authorization: <token>
```

### 2.1 获取课表

**接口**: `GET /api/schedule`

**描述**: 获取当前学期课表信息

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| refresh | boolean | 否 | 是否强制刷新缓存 |

**请求示例**:
```
GET /api/schedule
GET /api/schedule?refresh=true
```

**成功响应**:
```json
{
  "code": 200,
  "data": {
    "week": "第15周",
    "courses": [
      {
        "name": "数据结构",
        "teacher": "张老师",
        "location": "教学楼A101",
        "day": 1,
        "section": "1-2",
        "weekStr": "1-16周"
      }
    ],
    "_source": "cache"
  }
}
```

**字段说明**:
- `week`: 当前周次
- `courses`: 课程列表
  - `name`: 课程名称
  - `teacher`: 授课教师
  - `location`: 上课地点
  - `day`: 星期几（1=周一，7=周日）
  - `section`: 节次（如 "1-2" 表示第1-2节）
  - `weekStr`: 上课周次
- `_source`: 数据来源（`cache` 或 `network`）

**缓存策略**:
- 课表数据以"本周一 00:00"为界
- 缓存时间早于本周一则自动刷新
- 支持通过 `?refresh=true` 强制刷新

**注意事项**:
- 强制刷新时如果学校 Session 已失效，将返回 401
- 速率限制：60 次/分钟

---

### 2.2 获取一卡通信息

**接口**: `GET /api/ecard`

**描述**: 获取校园卡余额和状态

**请求参数**: 无

**成功响应**:
```json
{
  "code": 200,
  "data": {
    "balance": 125.50,
    "status": "正常",
    "lastTime": "2024-12-10 11:30:25",
    "_source": "network"
  }
}
```

**字段说明**:
- `balance`: 余额（元）
- `status`: 卡片状态
- `lastTime`: 最后交易时间
- `_source`: 固定为 `network`（实时数据）

**缓存策略**:
- 无缓存，每次请求均实时获取

**注意事项**:
- 速率限制：60 次/分钟

---

### 2.3 获取用户信息

**接口**: `GET /api/user`

**描述**: 获取学生基本信息

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| refresh | boolean | 否 | 是否强制刷新缓存 |

**成功响应**:
```json
{
  "code": 200,
  "data": {
    "name": "张三",
    "studentId": "202401001",
    "className": "软件工程2401",
    "identity": "本科生",
    "organizationCode": "CS2024",
    "_source": "cache"
  }
}
```

**字段说明**:
- `name`: 姓名
- `studentId`: 学号
- `className`: 班级名称
- `identity`: 身份（本科生/研究生等）
- `organizationCode`: 组织代码
- `_source`: 数据来源

**缓存策略**:
- 缓存有效期：30 天
- 学籍信息变动较少，长期缓存

**注意事项**:
- 速率限制：60 次/分钟

---

### 2.4 获取成绩单

**接口**: `GET /api/grades`

**描述**: 获取已出成绩列表，包含汇总信息和清洗后的课程成绩。

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| refresh | boolean | 否 | 是否强制刷新缓存 |

**请求示例**:
```
GET /api/grades
GET /api/grades?refresh=true
```

**成功响应**:
```json
{
  "code": 200,
  "data": {
    "summary": {
      "totalCourses": 26,
      "totalCredits": 60,
      "averageGpa": 2.2,
      "averageScore": 74.85
    },
    "items": [
      {
        "term": "2024-2025-1",
        "courseCode": "22000001",
        "courseName": "思想道德与法治",
        "groupName": "",
        "score": 87,
        "scoreText": "87",
        "pass": true,
        "flag": "",
        "credit": 3,
        "totalHours": 56,
        "gpa": 3.7,
        "retakeTerm": "",
        "examMethod": "考试",
        "examNature": "正常考试",
        "courseAttribute": "必修",
        "courseNature": "公共基础课",
        "courseCategory": ""
      }
    ],
    "_source": "network"
  }
}
```

**字段说明**:
- `summary.totalCourses`：所修门数
- `summary.totalCredits`：所修总学分
- `summary.averageGpa`：平均绩点
- `summary.averageScore`：平均成绩
- `items.score`：数值分数（无法转换则为 null）
- `items.scoreText`：原始成绩文本（如“及格”“中”）
- `items.pass`：是否通过（无法判断则为 null）
- 其他字段与教务系统表格列对应。

**实现细节**:
- 复现抓包请求：POST `https://xyjw.huas.edu.cn/jsxsd/kscj/cjcx_list`，`Content-Type: application/x-www-form-urlencoded`，`Referer: https://xyjw.huas.edu.cn/jsxsd/kscj/cjcx_query`，默认表单 `kksj=&kcxz=&kcmc=&xsfs=max`。
- 解析 HTML 表格，去除链接/颜色标记，自动提取分数、绩点、学分等数值。
- 缓存策略：12 小时，可通过 `refresh=true` 强制刷新。

---

## 3. 系统模块 (System)

### 3.1 健康检查

**接口**: `GET /system/health`

**描述**: 检查服务健康状态

**请求参数**: 无

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "status": "healthy",
    "timestamp": 1702195825000,
    "uptime": 86400.5
  }
}
```

**字段说明**:
- `status`: 服务状态
- `timestamp`: 当前时间戳
- `uptime`: 服务运行时间（秒）

---

### 3.2 系统统计

**接口**: `GET /system/stats`

**描述**: 获取完整系统统计数据

**请求参数**: 无

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "user": {
      "totalUsers": 1250,
      "activeUsersToday": 85,
      "activeUsersWeek": 320,
      "activeUsersMonth": 890,
      "newUsersToday": 5,
      "newUsersWeek": 32,
      "newUsersMonth": 128
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
}
```

---

### 3.3 用户统计

**接口**: `GET /system/stats/users`

**描述**: 获取用户维度统计

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "totalUsers": 1250,
    "activeUsersToday": 85,
    "activeUsersWeek": 320,
    "activeUsersMonth": 890,
    "newUsersToday": 5,
    "newUsersWeek": 32,
    "newUsersMonth": 128
  }
}
```

---

### 3.4 会话统计

**接口**: `GET /system/stats/sessions`

**描述**: 获取会话维度统计

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "totalSessions": 1580,
    "activeSessions": 1450,
    "tempSessions": 130,
    "multiDeviceUsers": 245
  }
}
```

---

### 3.5 缓存统计

**接口**: `GET /system/stats/cache`

**描述**: 获取缓存维度统计

**认证**: 🔒 **仅管理员可访问**

**请求头**:
```
Authorization: <admin_token>
```

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "totalCacheRecords": 3750,
    "scheduleCache": 1250,
    "ecardCache": 1250,
    "userInfoCache": 1250
  }
}
```

---

### 3.6 活跃用户排行

**接口**: `GET /system/stats/active-users`

**描述**: 获取最活跃用户排行榜

**认证**: 🔒 **仅管理员可访问**

**请求头**:
```
Authorization: <admin_token>
```

**查询参数**:
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| limit | number | 否 | 10 | 返回数量 |

**请求示例**:
```
GET /system/stats/active-users
GET /system/stats/active-users?limit=20
```

**响应示例**:
```json
{
  "code": 200,
  "data": [
    {
      "studentId": "202401001",
      "name": "张三",
      "lastActiveAt": 1702195825000
    }
  ]
}
```

---

## 4. 管理员权限说明

### 4.1 管理员认证

所有 `/system/stats/*` 路径下的统计接口需要管理员权限。

**管理员学号白名单**:
- `202412040130` - 喻祥云（系统管理员）

### 4.2 访问流程

1. 管理员使用学号 `202412040130` 登录
2. 获取 Token
3. 带上 Token 访问统计接口

**示例**:
```bash
# 1. 登录
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "<sessionId>",
    "username": "202412040130",
    "password": "<password>",
    "code": "<captcha>"
  }'

# 响应: { "code": 200, "token": "xxx-xxx-xxx" }

# 2. 访问管理接口
curl http://localhost:3000/system/stats \
  -H "Authorization: xxx-xxx-xxx"
```

### 4.3 错误响应

**未提供 Token**:
```json
{
  "code": 401,
  "msg": "未授权"
}
```

**Token 格式错误**:
```json
{
  "code": 401,
  "msg": "Token 格式无效"
}
```

**Token 已过期或不存在**:
```json
{
  "code": 401,
  "msg": "会话已过期或未登录"
}
```

**非管理员访问**:
```json
{
  "code": 403,
  "msg": "仅管理员可访问"
}
```

### 4.4 安全特性

- ✅ 基于学号白名单机制
- ✅ 与普通用户共用登录体系，无需单独管理
- ✅ 速率限制：100 次/分钟（管理员限流稍宽松）
- ✅ 所有操作均有完整的日志记录
- ✅ Token 校验、会话验证、权限检查多重防护

---

## 5. 错误处理

### 5.1 会话过期

**场景**: Token 无效或已过期

**响应**:
```json
{
  "code": 401,
  "msg": "请先登录"
}
```

**处理**: 前端应跳转到登录页

---

### 5.2 速率限制

**场景**: 请求过于频繁

**响应**:
```json
{
  "code": 429,
  "msg": "请求过于频繁，请稍后再试"
}
```

**处理**: 前端应延迟重试

---

### 5.3 学校服务异常

**场景**: 教务系统无响应或崩溃

**响应**:
```json
{
  "code": 500,
  "msg": "数据获取失败"
}
```

**处理**: 前端提示"服务繁忙"，不应跳转登录页

---

## 6. 最佳实践

### 6.1 Token 管理
- 登录后将 Token 存储在安全位置（如 localStorage）
- 每次请求携带 Token
- 收到 401 错误时清除 Token 并跳转登录

### 6.2 缓存优化
- 优先使用缓存数据，减少服务器压力
- 仅在必要时使用 `refresh=true`
- 一卡通数据总是实时的，无需刷新

### 6.3 错误处理
- 区分 401（需要重新登录）和 500（服务异常）
- 实现请求重试机制
- 显示友好的错误提示

### 6.4 性能优化
- 合并多个请求
- 实现本地缓存
- 避免频繁刷新

---

## 附录

### A. 数据来源标识

| 标识 | 说明 | 适用接口 |
|------|------|---------|
| cache | 缓存数据 | 课表、用户信息 |
| network | 实时数据 | 一卡通 |

### B. 速率限制汇总

| 接口类型 | 限制 |
|---------|----- -|
| 验证码 | 20 次/分钟 |
| 登录 | 10 次/分钟 |
| 业务 API | 60 次/分钟 |
| 管理员 API | 100 次/分钟 |
| 系统公开 API | 无限制 |

### C. 缓存策略汇总

| 数据类型 | TTL | 刷新策略 |
|---------|-----|---------|
| 课表 | 动态（周一零点过期）| 支持强制刷新 |
| 一卡通 | 无缓存 | 总是实时 |
| 用户信息 | 30 天 | 支持强制刷新 |
