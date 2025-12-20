# 生产部署检查清单

## 部署前检查

### 代码质量
- [x] TypeScript 类型检查通过 (`bun run lint`)
- [x] 所有单元测试通过 (`bun test`)
- [x] 安全测试通过 (`bun run test:security`)
- [x] 移除所有 console.log 调试代码
- [x] 代码已添加完整注释

### 安全配置
- [x] CORS 配置限制到具体域名
- [x] Token 格式验证（UUID v4）
- [x] 速率限制已配置
  - [x] 登录限制：5次/分钟
  - [x] 验证码限制：15次/分钟  
  - [x] API 限制：100次/分钟
- [x] 输入参数验证
- [x] 日志敏感信息脱敏
- [ ] 数据库加密（如需要）
- [ ] HTTPS 证书配置

### 环境配置
- [ ] .env.production 已配置
  - [ ] CORS_ORIGINS 设置为生产域名
  - [ ] DB_PATH 指向生产数据库路径
  - [ ] LOG_FILE_PATH 配置正确
  - [ ] NODE_ENV=production
- [ ] 数据库目录权限正确
- [ ] 日志目录已创建且有写权限
- [ ] systemd 服务文件已配置

### 监控和日志
- [x] 日志系统已启用
- [x] 日志轮转已配置（10MB，保留7天）
- [x] 性能监控已启用
- [x] 健康检查端点 `/health`
- [x] 性能指标端点 `/metrics.json`（监控端口）
- [ ] 外部监控系统配置（如 Prometheus）
- [ ] 告警规则配置

### 进程管理
- [x] 优雅关闭已实现
- [x] 信号处理（SIGTERM、SIGINT）
- [x] 未捕获异常处理
- [x] 数据库连接自动关闭
- [ ] systemd 服务已测试
- [ ] 自动重启已配置

### 性能优化
- [x] SQLite WAL 模式已启用
- [x] 数据库索引已创建
- [x] 缓存策略已优化
  - [x] 用户信息：30天
  - [x] 课表/成绩/一卡通：默认实时
- [x] 定时清理任务已配置

## 部署步骤检查

### 服务器准备
- [ ] 服务器满足最低配置
  - [ ] 2核 CPU
  - [ ] 2GB 内存
  - [ ] 10GB 磁盘空间
- [ ] Bun 已安装
- [ ] 防火墙规则已配置
- [ ] 必要目录已创建
  - [ ] /opt/huas-api
  - [ ] /var/lib/huas-api
  - [ ] /var/log/huas-api

### 部署执行
- [ ] 代码已上传到服务器
- [ ] 依赖已安装 (`bun install --production`)
- [ ] 文件权限已设置
- [ ] systemd 服务已启用
- [ ] 服务已启动成功

### 部署后验证
- [ ] 服务状态正常
  ```bash
  systemctl status huas-api
  ```
- [ ] 健康检查通过
  ```bash
  curl http://localhost:12103/health
  ```
- [ ] 性能指标正常
  ```bash
  curl http://localhost:13001/metrics.json
  ```
- [ ] 日志正常输出
  ```bash
  journalctl -u huas-api -n 20
  ```
- [ ] 数据库文件创建成功
- [ ] API 端点测试通过
  - [ ] GET /auth/captcha
  - [ ] POST /auth/login
  - [ ] GET /api/schedule
  - [ ] GET /api/user
  - [ ] GET /api/ecard

### 反向代理配置（如使用 Nginx）
- [ ] Nginx 已安装
- [ ] SSL 证书已配置
- [ ] 反向代理配置正确
- [ ] HTTPS 重定向已启用
- [ ] 限流规则已配置
- [ ] Nginx 配置已测试
  ```bash
  nginx -t
  ```

## 上线后监控

### 第一天
- [ ] 每小时检查服务状态
- [ ] 监控错误日志
- [ ] 检查数据库大小增长
- [ ] 验证缓存命中率
- [ ] 监控响应时间

### 第一周
- [ ] 每天检查性能指标
- [ ] 审查错误日志
- [ ] 验证自动清理任务
- [ ] 检查日志轮转
- [ ] 数据库备份验证

### 持续监控
- [ ] 配置自动告警
- [ ] 定期性能审查
- [ ] 容量规划
- [ ] 安全审计

## 应急预案

### 服务无法启动
1. 检查日志：`journalctl -u huas-api -n 50`
2. 验证配置文件
3. 检查端口占用
4. 回滚到上一个版本

### 性能下降
1. 查看性能指标：`/metrics.json`
2. 检查数据库大小
3. 验证缓存命中率
4. 调整速率限制

### 数据库损坏
1. 停止服务
2. 从备份恢复
3. 验证数据完整性
4. 重启服务

### 安全事件
1. 立即封禁攻击 IP
2. 审查访问日志
3. 加强速率限制
4. 更新安全规则

## 回滚计划

如果部署出现问题，执行回滚：

1. **停止新版本服务**
   ```bash
   sudo systemctl stop huas-api
   ```

2. **恢复旧版本代码**
   ```bash
   cd /opt/huas-api
   git checkout <previous-version>
   ```

3. **重新安装依赖**
   ```bash
   bun install --production
   ```

4. **重启服务**
   ```bash
   sudo systemctl start huas-api
   ```

5. **验证回滚成功**
   ```bash
   curl http://localhost:12103/health
   ```

