# HUAS API 测试规范与测试要求

## 1. 测试目标与范围

本测试规范适用于 HUAS API 服务的所有代码变更和发布流程，目标是：

- **原子化测试**：每个功能点都有独立、清晰的测试用例
- **全量覆盖**：覆盖功能、边界、异常和安全攻击场景
- **数据完备**：同时使用模拟数据（Mock）和真实使用数据样本（脱敏）
- **可扩展性**：为后续新增接口、新功能提供统一的测试模板和流程

测试范围包括但不限于：

- 认证模块：`/auth/*`
- 业务模块：`/api/*`
- 系统模块：`/system/*`
- 内部核心组件：SessionRepo、CacheRepo、UserRepo、StudentService、各 Parser、security 校验函数等

---

## 2. 测试分层与目录结构

测试按职责划分为以下几层：

### 2.1 单元测试 (`src/test/unit/`)

**职责**：测试独立的函数、类方法、解析器等纯逻辑

**覆盖范围**：
- 解析器（ScheduleParser、UserParser、ECardParser）
- 工具函数（CryptoHelper、Logger等）
- Security 校验函数（validateLoginParams、isValidTokenFormat等）

**示例**：
```typescript
// src/test/unit/parsers.test.ts
test('应该正确解析有效的课程表 HTML', () => {
    const result = ScheduleParser.parse(MOCK_SCHEDULE_HTML);
    expect(result).not.toBeNull();
    expect(result?.week).toBe('第15周');
});
```

### 2.2 集成测试 (`src/test/integration/`)

**职责**：测试组件之间的协作，如 Repo + DB、Service + Repo

**覆盖范围**：
- SessionRepo 与数据库交互
- CacheRepo 缓存机制（含 TTL）
- UserRepo 用户数据管理
- Session 与 Cache 的联动逻辑

**示例文件**：
- `session-repo.test.ts` - 会话仓储测试
- `cache-repo.test.ts` - 缓存仓储测试
- `user-repo.test.ts` - 用户仓储测试
- `session-cache-link.test.ts` - 会话与缓存联动测试

### 2.3 E2E 测试 (`src/test/e2e/`)

**职责**：通过真实 HTTP 请求验证完整的接口行为

**覆盖范围**：
- 所有 HTTP 接口的请求/响应
- 鉴权流程
- 错误码和错误处理
- 速率限制
- 并发请求处理

**示例文件**：
- `auth-captcha.test.ts` - 验证码接口测试
- `auth-login.test.ts` - 登录接口测试
- `auth-logout.test.ts` - 登出接口测试
- `system-health.test.ts` - 健康检查接口测试

### 2.4 安全测试 (`src/test/security/`)

**职责**：模拟各种安全攻击场景，验证系统防护能力

**覆盖范围**：
- SQL 注入防御
- XSS 攻击防御
- 路径遍历防御
- 命令注入防御
- 暴力破解防御
- 数据越权防御

**示例**：
```typescript
test('应该拒绝所有 SQL 注入尝试', () => {
    for (const payload of ATTACK_PAYLOADS.SQL_INJECTION) {
        const result = validateLoginParams({
            sessionId: TEST_TOKENS.VALID,
            username: payload,
            password: 'Password123',
            code: 'AB12'
        });
        expect(result.valid).toBe(false);
    }
});
```

### 2.5 性能测试 (`src/test/performance/`)

**职责**：验证系统在高负载下的性能表现

**覆盖范围**：
- 缓存性能
- 多并发请求
- 热点接口响应时间
- 数据库查询性能

---

## 3. 测试用例设计原则

### 3.1 原子性

一个用例只验证一个功能点或一个明确的业务规则

**好的用例命名**：
- ✅ `应该拒绝非法学号格式`
- ✅ `应该在有缓存且未过期时直接返回缓存`

**不好的用例命名**：
- ❌ `测试登录功能`
- ❌ `验证数据`

### 3.2 可读性

用例遵循「Arrange-Act-Assert」结构：

```typescript
test('应该成功保存新用户资料', () => {
    // Arrange: 准备数据和环境
    const studentId = `test_${Date.now()}`;
    const name = '张三';
    const className = '计算机2024-1';
    
    // Act: 执行被测操作
    repo.saveProfile(studentId, name, className);
    
    // Assert: 断言结果
    const user = db.prepare("SELECT * FROM users WHERE student_id = ?").get(studentId);
    expect(user).not.toBeNull();
    expect(user.name).toBe('张三');
});
```

### 3.3 可重复性

- 测试执行顺序不应影响结果
- 所有修改数据库的测试必须在结束后清理数据

```typescript
afterEach(() => {
    // 清理测试数据
    testStudentIds.forEach(id => {
        db.run("DELETE FROM users WHERE student_id = ?", [id]);
    });
    testStudentIds = [];
});
```

### 3.4 覆盖性

对每个接口，均需覆盖：
- ✅ 正常路径
- ✅ 参数非法
- ✅ 权限/鉴权失败
- ✅ 上游异常
- ✅ 安全攻击载荷（如适用）

---

## 4. 各接口测试要求与数据集矩阵

### 4.1 认证模块 `/auth/*`

#### 4.1.1 GET /auth/captcha

**测试目标**：
- 确保验证码生成正确，session 创建正确
- 确保 IP 级速率限制生效

**测试类型**：
- E2E 测试：正常请求、速率限制、并发请求
- 集成测试：SessionRepo 中新增的临时会话记录正确

**数据集**：

| 类别 | 场景 | 数据示例 | 预期结果 |
|------|------|----------|----------|
| IP | 正常频率 | `127.0.0.1` 连续请求 < 限额 | 200 |
| IP | 超限频率 | `127.0.0.1` 连续请求 > 限额 | 429 |
| IP | 多 IP | 不同 IP 交替请求 | 互不影响 |

#### 4.1.2 POST /auth/login

**测试目标**：
- 参数校验完整且严格
- 登录成功后会话和用户信息状态正确
- 速率限制生效

**数据集矩阵**：

| 场景类别 | 场景 | 输入数据 | 预期结果 |
|----------|------|----------|----------|
| 正常登录 | 合法学号 + 合法密码 + 合法验证码 | `202401001` / `Password123` / `AB12` | 200 + token 返回 |
| 参数非法 | 学号太短 | `123` | 400，错误信息包含学号格式 |
| 参数非法 | 学号含特殊字符 | `2024-01-001` | 400 |
| 参数非法 | 密码太短 | `123` | 400 |
| 参数非法 | 密码过长 | 100 位字符 | 400 |
| 参数非法 | 验证码长度不足 | `1` | 400 |
| 参数非法 | 验证码含特殊字符 | `<scr` | 400 |
| 业务错误 | 密码错误 | 合法学号 + 错误密码 | 401 |
| 业务错误 | 验证码错误 | 合法学号 + 合法密码 + 错误验证码 | 401 |
| 速率限制 | 超出登录频率 | 同一 IP 重复登录超过限额 | 429 |
| 安全 | SQL 注入 | `' OR '1'='1` | 400 |
| 安全 | XSS | `<script>alert("xss")</script>` | 400 或不崩溃 |

#### 4.1.3 POST /auth/logout

**测试目标**：
- 幂等性：无论 token 是否存在，均返回 200
- 删除会话但不删除用户与缓存数据

**数据集矩阵**：

| 场景 | token | 预期结果 |
|------|-------|----------|
| 正常退出 | 合法 UUID v4，存在会话 | 200，session 被删除 |
| 非法 token | 非 UUID 格式 | 200，不报错 |
| 无 token | 未提供 Authorization | 200，不做任何变更 |
| 幂等性 | 连续两次登出 | 两次都返回 200 |

### 4.2 业务模块 `/api/*`

#### 4.2.1 GET /api/schedule

**测试目标**：
- 缓存策略正确（按周一过期）
- 强制刷新参数生效
- 鉴权正确

**数据集矩阵**：

| 场景类别 | 场景 | 前置状态 | 请求参数 | 预期结果 |
|----------|------|----------|----------|----------|
| 鉴权失败 | 无 token | 无 session | 无 | 401 |
| 鉴权失败 | 非法 token 格式 | 无 | `Authorization: invalid` | 401 |
| 会话无效 | token 合法但未绑定学号 | session.student_id 为空 | 合法 token | 401 |
| 无缓存 | 首次请求 | 无 data_cache 记录 | 默认 | 200，`_source: 'network'` |
| 缓存命中 | 未过期缓存 | data_cache.updated_at >= 本周一 | 默认 | 200，`_source: 'cache'` |
| 缓存过期 | 已过期缓存 | data_cache.updated_at < 本周一 | 默认 | 200，`_source: 'network'` |
| 强制刷新 | `refresh=true` | 任何缓存状态 | `refresh=true` | 总是 `_source: 'network'` |
| 上游异常 | 学校系统错误响应 | 模拟异常 HTML | 默认 | 500，错误日志 |

#### 4.2.2 GET /api/ecard

**测试目标**：
- 实时数据（不使用缓存）
- 正确解析余额和状态
- 鉴权正确

**数据集**：

| 场景 | 数据样本 | 预期结果 |
|------|----------|----------|
| 正常卡 | balance: 100.50, status: '正常' | 200，正确返回 |
| 余额 0 | balance: 0 | 200，余额为 0 |
| 状态挂失 | status: '挂失' | 200，状态正确显示 |
| 上游错误 | code: '500' | 500 或空数据 |

#### 4.2.3 GET /api/user

**测试目标**：
- 缓存策略正确（30天）
- 更新 users 表
- 鉴权正确

### 4.3 系统模块 `/system/*`

#### 4.3.1 GET /system/health

**测试目标**：
- 始终返回 200
- 包含 status、timestamp、uptime
- 响应时间 < 500ms

#### 4.3.2 GET /system/stats

**测试目标**：
- 返回结构字段完备
- 数据类型正确（数字都为非负）
- 在大量数据时仍能快速响应

---

## 5. 数据集管理规范

### 5.1 模拟数据（Mock）

所有 Mock 数据定义在 `src/test/helpers/MockData.ts`

**组织方式**：

```typescript
// 按功能模块命名
export const MOCK_SCHEDULE_HTML = `...`;
export const MOCK_USER_INFO_JSON = {...};

// 测试用 Token
export const TEST_TOKENS = {
    VALID: '550e8400-e29b-41d4-a716-446655440000',
    INVALID_FORMAT: 'invalid-token-123',
    NON_EXISTENT: '550e8400-e29b-41d4-a716-446655440999',
};

// 登录测试数据集
export const LOGIN_TEST_DATASETS = {
    VALID: {...},
    INVALID_STUDENT_ID_SHORT: {...},
    // ... 更多场景
};

// 攻击测试载荷
export const ATTACK_PAYLOADS = {
    SQL_INJECTION: [...],
    XSS: [...],
    PATH_TRAVERSAL: [...],
    COMMAND_INJECTION: [...],
};
```

### 5.2 真实使用数据样本（Real Fixtures）

**存放路径**：`src/test/fixtures/`

**文件命名规范**：
- `real-schedule-complex.html` - 真实课表 HTML 样本
- `real-user-info-complete.json` - 真实用户信息 JSON 样本
- `real-ecard-with-transactions.json` - 真实一卡通 JSON 样本

**脱敏要求**：
- ✅ 学号改为测试数据（如 `202401001`）
- ✅ 姓名改为通用名称（如 `测试学生`）
- ✅ 身份证号打码（如 `320***********1234`）
- ✅ 手机号使用虚拟号码（如 `13800138000`）
- ❌ 不得包含真实用户隐私信息

**使用方式**：

```typescript
import fs from 'fs';
import path from 'path';

const realScheduleHTML = fs.readFileSync(
    path.join(__dirname, '../fixtures/real-schedule-complex.html'),
    'utf-8'
);

test('应该正确解析真实课表样本', () => {
    const result = ScheduleParser.parse(realScheduleHTML);
    expect(result).not.toBeNull();
    expect(result?.courses.length).toBeGreaterThan(0);
});
```

### 5.3 测试数据库

**标识前缀**：所有测试用学号必须以 `test_` 或 `202499xxx` 等明显前缀标识

**清理策略**：

```typescript
afterEach(() => {
    // 清理测试数据
    testTokens.forEach(token => {
        db.run("DELETE FROM sessions WHERE token = ?", [token]);
    });
    testStudentIds.forEach(id => {
        db.run("DELETE FROM data_cache WHERE student_id = ?", [id]);
        db.run("DELETE FROM users WHERE student_id = ?", [id]);
    });
});
```

---

## 6. 安全测试要求

### 6.1 攻击场景覆盖

**必须测试的攻击类型**：

1. **SQL 注入**
   - `' OR '1'='1`
   - `'; DROP TABLE users--`
   - `admin'--`
   - `1' UNION SELECT NULL--`

2. **XSS 攻击**
   - `<script>alert("xss")</script>`
   - `<img src=x onerror=alert("xss")>`
   - `javascript:alert("xss")`
   - `<svg onload=alert("xss")>`

3. **路径遍历**
   - `../../../etc/passwd`
   - `..\\..\\..\\windows\\system32`
   - `%2e%2e%2f%2e%2e%2f`

4. **命令注入**
   - `; ls -la`
   - `| cat /etc/passwd`
   - `` `whoami` ``
   - `$(reboot)`

### 6.2 安全测试要求

**对每个接口**：

1. 明确安全要求：
   - 是否需要鉴权？
   - 是否需要速率限制？
   - 是否涉及用户输入的解析或拼接？

2. 编写对应的安全测试：
   - 包含用户输入的就要考虑注入 / XSS / 越权等风险
   - 所有参数校验函数都要有单元测试 + 安全测试

3. 验证防护措施：
   - 输入验证是否严格？
   - 是否有白名单过滤？
   - 是否有输出编码？

---

## 7. 性能与压力测试要求

### 7.1 热点接口

需要进行性能测试的接口：
- `/api/schedule`
- `/api/ecard`
- `/api/user`
- `/auth/login`
- `/system/health`

### 7.2 性能指标

**响应时间**：
- P50 < 100ms
- P95 < 500ms
- P99 < 1000ms

**并发能力**：
- 支持 100 并发请求不崩溃
- 支持 500 并发请求时 P95 < 2s

**缓存效果**：
- 缓存命中率 > 80%
- 缓存命中时响应时间 < 50ms

### 7.3 测试方法

```typescript
test('并发访问下的响应时间', async () => {
    const concurrentRequests = 100;
    const startTime = Date.now();
    
    const requests = Array(concurrentRequests).fill(null).map(() =>
        fetch(`${BASE_URL}/api/schedule`, {
            headers: { 'Authorization': validToken }
        })
    );
    
    const responses = await Promise.all(requests);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // 所有请求都应该成功
    responses.forEach(r => expect(r.status).toBe(200));
    
    // 总时间应该在合理范围内
    expect(duration).toBeLessThan(5000); // 5秒内完成100个请求
});
```

---

## 8. 覆盖率要求与门槛

### 8.1 覆盖率指标

使用 `bun test --coverage` 生成覆盖率报告

**下限要求**：
- 行覆盖率：≥ 80%
- 分支覆盖率：≥ 70%
- 关键模块（security、auth、schedule）行覆盖率：≥ 90%

### 8.2 CI 集成

任何代码改动（包括重构）必须保证：
- 覆盖率不下降
- 所有测试通过

**CI 配置示例**：

```yaml
test:
  script:
    - bun test --coverage
    - bun run test:ci
  coverage:
    min_coverage: 80
    fail_on_decrease: true
```

---

## 9. 新增功能 / 接口时的测试流程（Checklist）

当新增功能或接口时，必须按照以下步骤进行：

### 9.1 规划阶段

- [ ] 明确功能点以及涉及的路由和模块
- [ ] 确定需要哪些测试类型（单元/集成/E2E/安全）
- [ ] 设计测试数据集矩阵（参考本文档第 4 节）

### 9.2 实现阶段

- [ ] 为每个功能点编写：
  - [ ] 单元测试（解析、校验、核心逻辑）
  - [ ] 集成测试（Repo + DB / Service + Repo）
  - [ ] E2E 测试（HTTP 接口）
  - [ ] 安全测试（如涉及用户输入）

- [ ] 补充或更新测试数据：
  - [ ] MockData（如需要新的模拟数据）
  - [ ] 真实样本 fixtures（如需要新的真实数据结构）

### 9.3 验证阶段

- [ ] 运行：
  - [ ] `./scripts/test.sh all` - 运行所有测试
  - [ ] `./scripts/test.sh coverage` - 检查覆盖率

- [ ] 检查结果：
  - [ ] 所有测试通过 ✅
  - [ ] 覆盖率达到门槛 ✅
  - [ ] 无新增告警或错误 ✅

### 9.4 文档阶段

- [ ] 更新本文档中对应的测试要求和场景说明
- [ ] 在接口文档（API.md）中标注测试覆盖情况
- [ ] 记录特殊的测试注意事项

---

## 10. 测试运行指南

### 10.1 运行所有测试

```bash
# 运行所有测试
./scripts/test.sh all

# 或使用 bun 命令
bun test
```

### 10.2 按类型运行测试

```bash
# 单元测试
./scripts/test.sh unit

# 集成测试
./scripts/test.sh integration

# E2E 测试
./scripts/test.sh e2e

# 安全测试
./scripts/test.sh security

# 性能测试
./scripts/test.sh performance
```

### 10.3 快捷命令

```bash
# 快速测试（仅运行单元+集成）
./scripts/test.sh quick

# 烟雾测试（仅运行关键接口）
./scripts/test.sh smoke

# 监听模式（文件变化时自动运行）
./scripts/test.sh watch

# CI 模式（无彩色输出）
./scripts/test.sh ci
```

### 10.4 生成覆盖率报告

```bash
# 生成覆盖率报告
./scripts/test.sh coverage

# 或使用 bun 命令
bun test --coverage
```

---

## 11. 测试最佳实践

### 11.1 测试命名

**好的命名**：
- 使用「应该...」开头描述期望行为
- 清晰说明测试场景和预期结果
- 使用中文提高可读性

```typescript
// ✅ 好的命名
test('应该拒绝包含特殊字符的学号', () => {...});
test('应该在缓存过期后返回 null', () => {...});

// ❌ 不好的命名
test('test1', () => {...});
test('login', () => {...});
```

### 11.2 测试隔离

每个测试应该独立运行，不依赖其他测试的状态：

```typescript
// ✅ 好的实践 - 每个测试独立准备数据
test('测试A', () => {
    const data = prepareTestData();
    // ... 测试逻辑
    cleanup(data);
});

test('测试B', () => {
    const data = prepareTestData();
    // ... 测试逻辑
    cleanup(data);
});

// ❌ 不好的实践 - 测试之间有依赖
let sharedData;
test('测试A', () => {
    sharedData = createData();
});
test('测试B', () => {
    // 依赖测试A的结果
    doSomething(sharedData);
});
```

### 11.3 错误消息

提供清晰的错误消息，帮助快速定位问题：

```typescript
// ✅ 好的实践
expect(result.code).toBe(200, `期望返回码为 200，实际为 ${result.code}`);

// ✅ 更好的实践
test('应该返回正确的课程数量', () => {
    const courses = result?.courses;
    expect(courses).toBeDefined(`课程列表不应为 undefined`);
    expect(courses.length).toBe(5, `期望5门课程，实际为 ${courses?.length}`);
});
```

### 11.4 异步测试

正确处理异步操作：

```typescript
// ✅ 使用 async/await
test('异步操作应该正确处理', async () => {
    const result = await fetchData();
    expect(result).not.toBeNull();
});

// ✅ 使用 Promise
test('Promise 应该正确处理', () => {
    return fetchData().then(result => {
        expect(result).not.toBeNull();
    });
});

// ❌ 忘记等待异步操作
test('错误的异步测试', () => {
    fetchData().then(result => {
        expect(result).not.toBeNull(); // 可能不会执行
    });
});
```

---

## 12. 故障排查指南

### 12.1 测试失败时的检查步骤

1. **查看错误信息**
   - 仔细阅读失败的错误消息
   - 确认是哪个断言失败了

2. **检查测试数据**
   - 验证测试数据是否正确准备
   - 确认测试数据是否被其他测试污染

3. **隔离测试**
   - 单独运行失败的测试
   - 确认是测试本身的问题还是环境问题

4. **检查依赖**
   - 确认数据库状态
   - 确认外部服务是否可用

### 12.2 常见问题

**问题1：测试数据未清理**

```typescript
// 解决方案：使用 afterEach 清理
afterEach(() => {
    testStudentIds.forEach(id => {
        db.run("DELETE FROM users WHERE student_id = ?", [id]);
    });
    testStudentIds = [];
});
```

**问题2：测试顺序依赖**

```typescript
// 解决方案：确保每个测试独立
test('测试A', () => {
    // 完整的准备 + 执行 + 清理
});
```

**问题3：异步超时**

```typescript
// 解决方案：增加超时时间
test('长时间异步操作', async () => {
    // ... 测试逻辑
}, { timeout: 30000 }); // 30秒超时
```

---

## 13. 附录：测试示例

### 13.1 单元测试示例

```typescript
// src/test/unit/security.test.ts
import { describe, test, expect } from 'bun:test';
import { validateLoginParams } from '../../core/security';
import { TEST_TOKENS } from '../helpers/MockData';

describe('validateLoginParams', () => {
    test('应该拒绝包含特殊字符的学号', () => {
        const result = validateLoginParams({
            sessionId: TEST_TOKENS.VALID,
            username: '2024-01-001',
            password: 'Password123',
            code: 'AB12',
        });

        expect(result.valid).toBe(false);
        expect(result.error).toContain('学号');
    });
    
    test('应该接受合法的参数', () => {
        const result = validateLoginParams({
            sessionId: TEST_TOKENS.VALID,
            username: '202401001',
            password: 'Password123',
            code: 'AB12',
        });

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
    });
});
```

### 13.2 集成测试示例

```typescript
// src/test/integration/cache-repo.test.ts
import { describe, test, expect, afterEach } from 'bun:test';
import { CacheRepo } from '../../db/CacheRepo';
import { db } from '../../db/index';

describe('CacheRepo 集成测试', () => {
    let repo: CacheRepo;
    let testStudentIds: string[] = [];

    beforeEach(() => {
        repo = new CacheRepo();
    });

    afterEach(() => {
        testStudentIds.forEach(id => {
            db.run("DELETE FROM data_cache WHERE student_id = ?", [id]);
        });
        testStudentIds = [];
    });

    test('应该成功写入并读取缓存', () => {
        const studentId = `test_${Date.now()}`;
        testStudentIds.push(studentId);
        const data = { name: '张三', class: '计算机2024-1' };
        
        repo.set(studentId, 'USER_INFO', data);
        const cached = repo.get<typeof data>(studentId, 'USER_INFO', 0);
        
        expect(cached).not.toBeNull();
        expect(cached?.name).toBe('张三');
    });
});
```

### 13.3 E2E 测试示例

```typescript
// src/test/e2e/auth-login.test.ts
import { describe, test, expect, beforeAll } from 'bun:test';

describe('E2E - POST /auth/login', () => {
    const BASE_URL = 'http://localhost:3000';
    let validSessionId: string;

    beforeAll(async () => {
        const response = await fetch(`${BASE_URL}/auth/captcha`);
        const data = await response.json();
        validSessionId = data.data.sessionId;
    });

    test('应该拒绝学号过短', async () => {
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: validSessionId,
                username: '123',
                password: 'Password123',
                code: 'AB12'
            })
        });
        const data = await response.json();
        
        expect(response.status).toBe(400);
        expect(data.code).toBe(400);
        expect(data.msg).toContain('学号');
    });
});
```

---

## 14. 更新记录

| 日期 | 版本 | 更新内容 | 更新人 |
|------|------|----------|--------|
| 2025-12-10 | 1.0.0 | 初始版本，完整测试规范 | - |

---

**文档维护者**：开发团队  
**最后更新**：2025-12-10
