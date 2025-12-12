# 部署指南（前后端联调版）

## 后端（Bun + Hono）
1. 安装依赖：`bun install`
2. 配置环境：`.env`（`PORT=3000` 等）
3. 启动开发：`PORT=3000 NODE_ENV=development bun run dev`
4. 生产：`PORT=12103 NODE_ENV=production bun run start`（可用 `systemd`/`deploy/deploy.sh`）

## 前端（Next App Router / apps/mobile）
1. 进入前端目录：`cd apps/mobile`
2. 配置接口地址：`HUAS_API_BASE=http://localhost:3000` 写入 `.env`
3. 安装依赖：`bun install`
4. 启动开发：`bun dev --port 4000`

## 联调说明
- 后端默认 CORS 允许本地开发；生产需配置 `CORS_ORIGINS`。
- 登录成功后 token 保存在后端 sessions 中，前端走 `/auth/login` 获取 token 并在 30 天内复用。
- 如需反向代理：将前端域名代理到 Next（4000），后端域名代理到 Hono（3000/12103），或在网关层转发 `/auth/*`、`/api/*` 到后端。

## 目录清理
- 旧的 `pnpm-workspace.yaml`、`pnpm-lock` 已移除；当前默认使用 Bun 包管理和脚本。
