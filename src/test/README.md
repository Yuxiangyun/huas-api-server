# 测试说明

## 测试分层

本项目采用分层测试策略，确保全面覆盖：

### 1. 单元测试 (src/test/unit/)
- **职责**: 测试独立的函数、类方法、解析器
- **运行**: `./scripts/test.sh unit`
- **特点**: 不需要数据库、不需要网络、执行速度快

### 2. 集成测试 (src/test/integration/)
- **职责**: 测试组件协作（Repo + DB、Service + Repo）
- **运行**: `./scripts/test.sh integration`
- **特点**: 使用真实数据库、测试数据自动清理

### 3. E2E 测试 (src/test/e2e/)
- **职责**: 测试完整的HTTP接口行为
- **运行**: `./scripts/test.sh e2e`
- **特点**: **需要服务器运行在 http://localhost:3000**

### 4. 安全测试 (src/test/security/)
- **职责**: 模拟攻击场景，验证防护能力
- **运行**: `./scripts/test.sh security`
- **特点**: 包含SQL注入、XSS、路径遍历等攻击测试

### 5. 性能测试 (src/test/performance/)
- **职责**: 验证系统性能表现
- **运行**: `./scripts/test.sh performance`
- **特点**: 测试缓存性能、并发处理能力

## 快速开始

### 运行所有测试（不含E2E）
```bash
./scripts/test.sh all
```

### 运行快速测试（单元+集成）
```bash
./scripts/test.sh quick
```

### 运行E2E测试

**步骤1**: 启动开发服务器
```bash
bun run dev
```

**步骤2**: 在另一个终端运行E2E测试
```bash
./scripts/test.sh e2e
```

### 生成覆盖率报告
```bash
./scripts/test.sh coverage
```

## 测试数据管理

### Mock数据
所有模拟数据定义在 `src/test/helpers/MockData.ts`

### 真实样本数据
脱敏后的真实数据存放在 `src/test/fixtures/`
- `real-schedule-complex.html` - 真实课表HTML
- `real-user-info-complete.json` - 真实用户信息
- `real-ecard-with-transactions.json` - 真实一卡通数据

### 测试数据清理
所有测试都会自动清理数据，使用 `test_` 前缀标识测试数据

## 注意事项

### E2E测试失败？
如果看到 `ConnectionRefused` 错误，说明服务器未启动。

**解决方案**:
1. 启动服务器: `bun run dev`
2. 或跳过E2E测试: `./scripts/test.sh quick`

### E2E测试速率限制问题

由于API有速率限制（验证码接口：20次/分钟，登录接口：10次/分钟），**连续多次运行E2E测试可能会触发速率限制**，导致部分测试失败并返回 `429 (Too Many Requests)`。

**这是正常现象**，说明速率限制机制正在工作。解决方案：

1. **等待1分钟后重试** - 速率限制会自动重置
2. **单独运行测试文件** - 避免一次性运行所有E2E测试
   ```bash
   bun test src/test/e2e/auth-captcha.test.ts
   ```
3. **调整速率限制配置**（仅用于测试环境）
   ```bash
   CAPTCHA_RATE_LIMIT=100 LOGIN_RATE_LIMIT=50 bun run dev
   ```

**重要提示**：
- E2E测试已经针对速率限制做了容错处理，会正确处理429响应
- 如果测试显示 "Expected: >= 1, Received: 0"，说明所有请求都被限流了
- 生产环境不应修改速率限制配置，这是重要的安全防护

### 测试数据污染？
每个测试都应该在 `afterEach` 中清理数据，参考现有测试用例。

### 需要添加新测试？
参考 `doc/TESTING.md` 中的详细规范和示例。

## 测试统计

当前测试覆盖：
- ✅ 181 个测试用例（不含E2E）
- ✅ 403 个断言
- ✅ 100% 通过率
- ⏱️ 执行时间: ~3秒

## 更多信息

完整的测试规范和要求请查看: [doc/TESTING.md](../../doc/TESTING.md)
