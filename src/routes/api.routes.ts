/**
 * API 路由配置
 * 集中管理所有业务 API 路由，方便维护和扩展
 */
import type { Hono } from 'hono';
import { StudentService } from '../services/StudentService';
import { createHandler } from '../core/handlers/RouteHandler';
import { createAuthMiddleware } from '../core/middleware/MiddlewareFactory';
import { SECURITY_CONFIG } from '../config';

/**
 * 注册所有 API 路由
 * @param app Hono 应用实例
 */
export function registerApiRoutes<E extends { Variables: { userId: string; clientIP: string; } }>(app: Hono<E>) {
    // API 认证中间件
    app.use('/api/*', createAuthMiddleware({
        enableRateLimit: true,
        rateLimit: SECURITY_CONFIG.API_RATE_LIMIT
    }));
    
    // 获取课程表
    app.get('/api/schedule', createHandler(async (c) => {
        const refresh = c.req.query('refresh') === 'true';
        const service = new StudentService(c.get('userId'));
        return service.getSchedule(refresh);
    }));
    
    // 获取用户信息
    app.get('/api/user', createHandler(async (c) => {
        const refresh = c.req.query('refresh') === 'true';
        const service = new StudentService(c.get('userId'));
        return service.getUserInfo(refresh);
    }));
    
    // 获取一卡通余额
    app.get('/api/ecard', createHandler(async (c) => {
        const service = new StudentService(c.get('userId'));
        return service.getECard();
    }));
}
