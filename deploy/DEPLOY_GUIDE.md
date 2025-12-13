# 部署指南

## 后端（Bun + Hono）
1. 安装依赖：`bun install`
2. 配置环境：`.env`（`PORT=3000` 等）
3. 启动开发：`PORT=3000 NODE_ENV=development bun run dev`
4. 生产：`PORT=12103 NODE_ENV=production bun run start`（可用 `systemd`/`deploy/deploy.sh`）
5. 静态页：访问 `http://HOST:PORT/`，Hono 会返回根目录的 `index.html`。

## 前端（静态 HTML）
- 现仅保留根目录的 `index.html` 作为界面，无需单独的 Next.js 构建或启动。
- 修改页面逻辑或样式时，直接编辑 `index.html`，重启后端即可生效。

## 联调说明
- 后端默认 CORS 允许本地开发；生产需配置 `CORS_ORIGINS`。
- 登录成功后 token 保存在后端 sessions 中，前端走 `/auth/login` 获取 token 并在 30 天内复用。
- 反向代理：统一代理到后端端口（默认 3000/12103），`/` 提供页面，`/auth/*`、`/api/*` 提供接口。

## 目录清理
- 旧的 Next.js 前端已移除；仅保留 Bun 后端与根目录 `index.html`。
- 默认使用 Bun 包管理和脚本。
