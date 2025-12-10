# HUAS API 部署文档

## 系统要求

### 服务器环境
- **操作系统**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **CPU**: 2核心+
- **内存**: 2GB+
- **磁盘**: 10GB+ 可用空间
- **网络**: 稳定的网络连接，支持 HTTPS

### 软件依赖
- **Bun**: v1.0.0+
- **Node.js**: v18.0.0+ (可选，用于开发工具)
- **systemd**: 用于进程管理
- **rsync**: 用于文件同步

## 快速部署

### 1. 安装 Bun

```bash
# 安装 Bun
curl -fsSL https://bun.sh/install | bash

# 验证安装
bun --version
```

### 2. 克隆代码

```bash
# 克隆仓库
git clone <repository-url> huas-api
cd huas-api

# 安装依赖
bun install
```

### 3. 配置环境

```bash
# 复制生产环境配置
cp .env.production .env

# 编辑配置文件
vi .env
```

**重要配置项**：

```bash
# CORS 来源（替换为实际域名）
CORS_ORIGINS=https://your-domain.com

# 数据库路径
DB_PATH=/var/lib/huas-api/huas.sqlite

# 日志路径
LOG_FILE_PATH=/var/log/huas-api/app.log

# 安全配置
LOGIN_RATE_LIMIT=5
CAPTCHA_RATE_LIMIT=15
API_RATE_LIMIT=100
```

### 4. 执行部署

```bash
# 赋予执行权限
chmod +x deploy/deploy.sh

# 执行部署（需要 sudo）
sudo ./deploy/deploy.sh
```

## 手动部署步骤

如果自动部署脚本不适用，可以手动执行以下步骤：

### 1. 创建目录

```bash
sudo mkdir -p /opt/huas-api
sudo mkdir -p /var/lib/huas-api
sudo mkdir -p /var/log/huas-api
```

### 2. 复制文件

```bash
sudo rsync -av --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.sqlite*' \
    ./ /opt/huas-api/
```

### 3. 安装依赖

```bash
cd /opt/huas-api
sudo bun install --production
```

### 4. 配置权限

```bash
sudo chown -R www-data:www-data /opt/huas-api
sudo chown -R www-data:www-data /var/lib/huas-api
sudo chown -R www-data:www-data /var/log/huas-api
sudo chmod 640 /opt/huas-api/.env.production
```

### 5. 安装服务

```bash
sudo cp deploy/huas-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable huas-api
sudo systemctl start huas-api
```

### 6. 验证部署

```bash
# 检查服务状态
sudo systemctl status huas-api

# 查看日志
sudo journalctl -u huas-api -f

# 健康检查
curl http://localhost:3000/health

# 性能指标
curl http://localhost:3000/metrics
```

## Nginx 反向代理配置

### 安装 Nginx

```bash
sudo apt update
sudo apt install nginx
```

### 配置示例

创建 `/etc/nginx/sites-available/huas-api`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书配置
    ssl_certificate /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 日志
    access_log /var/log/nginx/huas-api.access.log;
    error_log /var/log/nginx/huas-api.error.log;

    # 反向代理
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 限流配置
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    location /api/ {
        limit_req zone=api burst=20;
        proxy_pass http://localhost:3000;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/huas-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 常用运维命令

### 服务管理

```bash
# 启动服务
sudo systemctl start huas-api

# 停止服务
sudo systemctl stop huas-api

# 重启服务
sudo systemctl restart huas-api

# 查看状态
sudo systemctl status huas-api

# 开机自启
sudo systemctl enable huas-api

# 禁用自启
sudo systemctl disable huas-api
```

### 日志查看

```bash
# 实时查看日志
sudo journalctl -u huas-api -f

# 查看最近 100 行
sudo journalctl -u huas-api -n 100

# 查看今天的日志
sudo journalctl -u huas-api --since today

# 查看应用日志文件
sudo tail -f /var/log/huas-api/app.log
```

### 数据库管理

```bash
# 备份数据库
sudo cp /var/lib/huas-api/huas.sqlite /var/lib/huas-api/backups/huas-$(date +%Y%m%d).sqlite

# 查看数据库大小
sudo du -h /var/lib/huas-api/huas.sqlite

# 清理 WAL 文件
sudo sqlite3 /var/lib/huas-api/huas.sqlite "PRAGMA wal_checkpoint(TRUNCATE);"
```

### 性能监控

```bash
# 查看系统资源使用
top -p $(pgrep -f huas-api)

# 查看内存使用
ps aux | grep huas-api

# 查看端口监听
sudo netstat -tulpn | grep 3000
```

## 更新部署

```bash
# 1. 拉取最新代码
cd huas-api
git pull

# 2. 重新部署
sudo ./deploy/deploy.sh
```

## 故障排查

### 服务无法启动

1. 检查日志：`sudo journalctl -u huas-api -n 50`
2. 检查配置文件：`cat /opt/huas-api/.env.production`
3. 检查文件权限：`ls -la /opt/huas-api`
4. 检查端口占用：`sudo lsof -i :3000`

### 数据库错误

1. 检查数据库文件权限
2. 检查磁盘空间：`df -h`
3. 重建数据库（谨慎）：删除旧数据库文件，重启服务

### 性能问题

1. 查看性能指标：`curl http://localhost:3000/metrics`
2. 检查内存使用：`free -h`
3. 检查磁盘 IO：`iostat -x 1`
4. 调整速率限制配置

## 安全加固建议

1. **防火墙配置**
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

2. **定期更新系统**
   ```bash
   sudo apt update && sudo apt upgrade
   ```

3. **配置自动备份**
   ```bash
   # 添加到 crontab
   0 2 * * * /usr/local/bin/backup-huas-db.sh
   ```

4. **监控日志异常**
   - 配置日志告警
   - 定期检查错误日志

## 性能优化

1. **数据库优化**
   - 定期执行 VACUUM
   - 保持 WAL 模式
   - 定期清理过期数据

2. **缓存策略**
   - 调整缓存 TTL
   - 监控缓存命中率

3. **系统调优**
   - 调整文件描述符限制
   - 配置 TCP 参数
   - 使用 SSD 存储数据库

## 技术支持

如遇问题，请提供以下信息：

1. 系统版本：`uname -a`
2. Bun 版本：`bun --version`
3. 服务日志：`sudo journalctl -u huas-api -n 100`
4. 错误截图或完整错误信息