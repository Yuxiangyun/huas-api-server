/**
 * 系统路由模块
 * 提供健康检查、统计数据等系统级接口
 */
import { Hono } from 'hono';
import { statsRepo } from '../db/StatsRepo';
import loggerInstance from '../core/utils/Logger';

const app = new Hono();

/**
 * 健康检查接口
 * GET /system/health
 */
app.get('/system/health', (c) => {
    return c.json({
        code: 200,
        data: {
            status: 'healthy',
            timestamp: Date.now(),
            uptime: process.uptime()
        }
    });
});

/**
 * 系统统计接口
 * GET /system/stats
 * 返回完整的系统统计数据
 */
app.get('/system/stats', (c) => {
    try {
        const stats = statsRepo.getSystemStats();
        loggerInstance.info("获取系统统计数据", { timestamp: stats.timestamp });
        
        return c.json({
            code: 200,
            data: stats
        });
    } catch (e: any) {
        loggerInstance.error("获取系统统计失败", { error: e.message });
        return c.json({
            code: 500,
            msg: "获取统计数据失败"
        }, 500);
    }
});

/**
 * 用户统计接口
 * GET /system/stats/users
 */
app.get('/system/stats/users', (c) => {
    try {
        const stats = statsRepo.getUserStats();
        return c.json({
            code: 200,
            data: stats
        });
    } catch (e: any) {
        loggerInstance.error("获取用户统计失败", { error: e.message });
        return c.json({
            code: 500,
            msg: "获取用户统计失败"
        }, 500);
    }
});

/**
 * 会话统计接口
 * GET /system/stats/sessions
 */
app.get('/system/stats/sessions', (c) => {
    try {
        const stats = statsRepo.getSessionStats();
        return c.json({
            code: 200,
            data: stats
        });
    } catch (e: any) {
        loggerInstance.error("获取会话统计失败", { error: e.message });
        return c.json({
            code: 500,
            msg: "获取会话统计失败"
        }, 500);
    }
});

/**
 * 缓存统计接口
 * GET /system/stats/cache
 */
app.get('/system/stats/cache', (c) => {
    try {
        const stats = statsRepo.getCacheStats();
        return c.json({
            code: 200,
            data: stats
        });
    } catch (e: any) {
        loggerInstance.error("获取缓存统计失败", { error: e.message });
        return c.json({
            code: 500,
            msg: "获取缓存统计失败"
        }, 500);
    }
});

/**
 * 活跃用户排行榜
 * GET /system/stats/active-users?limit=10
 */
app.get('/system/stats/active-users', (c) => {
    try {
        const limit = parseInt(c.req.query('limit') || '10');
        const ranking = statsRepo.getActiveUsersRanking(limit);
        return c.json({
            code: 200,
            data: ranking
        });
    } catch (e: any) {
        loggerInstance.error("获取活跃用户排行失败", { error: e.message });
        return c.json({
            code: 500,
            msg: "获取排行榜失败"
        }, 500);
    }
});

export default app;
