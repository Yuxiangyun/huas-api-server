# HUAS 行动端（Next.js RSC）

RSC + TanStack Query + Zustand + shadcn 风格组件，作为 Hono/Bun API 的移动端壳。

## 本地运行

```bash
# 1) 设置 API 地址（默认为 12103，避免与 Next dev 端口冲突）
cp .env.example .env
# 修改 HUAS_API_BASE=http://localhost:12103

# 2) 启动（建议 Next 用 4000 端口，API 用 12103）
bun --cwd apps/mobile dev --port 4000
```

## 主要特性
- RSC 页面 + 客户端组件，用 TanStack Query 请求 `/api/*`（Next API 转发到 Hono）
- Zustand 持久化（UI 偏好 + 登录 token 过期时间），HTTP-only cookie 30 天
- 路由：`/` 首页（课表占位）、`/wallet` 一卡通、`/profile` 我的、`/login` 登录
- shadcn 风格按钮/卡片/表单 + 移动底部 Tab 栏
