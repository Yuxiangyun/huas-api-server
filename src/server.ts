/**
 * 服务器入口文件
 * 提供 API 路由、中间件配置、安全防护
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { scheduler } from './core/Scheduler';
import loggerInstance from './core/utils/Logger';
import { processManager } from './core/utils/ProcessManager';
import { performanceMonitor } from './core/utils/PerformanceMonitor';
import { LogRotator } from './core/utils/LogRotator';
import { SERVER_CONFIG, LOG_CONFIG } from './config';
import { createPerformanceMiddleware } from './core/middleware/MiddlewareFactory';
import { registerApiRoutes } from './routes/api.routes';
import { registerAuthRoutes } from './routes/auth.routes';
import systemRoutes from './routes/system.routes';

// 应用环境类型定义
type HonoEnv = { Variables: { userId: string; clientIP: string; } };
const app = new Hono<HonoEnv>();

// ========== 中间件配置 ==========

/**
 * CORS 中间件
 * 生产环境限制允许的来源，开发环境允许所有来源
 */
app.use('/*', cors({
    origin: SERVER_CONFIG.IS_DEV ? '*' : SERVER_CONFIG.CORS_ORIGINS,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));

/**
 * 性能监控和日志中间件
 * 记录请求响应时间、状态，并提取客户端 IP
 */
app.use('*', createPerformanceMiddleware());

// ========== 路由注册 ==========

// 注册业务 API 路由
registerApiRoutes(app);

// 注册认证路由
registerAuthRoutes(app);

// 注册系统路由
app.route('/', systemRoutes);

// 静态页面服务
app.get('/', async (c) => {
    try {
        const file = Bun.file('./index.html');
        const html = await file.text();
        return c.html(html);
    } catch {
        return c.text('页面不存在', 404);
    }
});

// ========== 启动配置 ==========

// 初始化进程管理
processManager.init();

// 启动调度器
scheduler.start();

// 启动性能监控（生产环境）
if (!SERVER_CONFIG.IS_DEV) {
    performanceMonitor.startReporting(5 * 60 * 1000); // 5分钟报告一次
}

// 启动日志轮转（生产环境）
if (!SERVER_CONFIG.IS_DEV && LOG_CONFIG.ENABLE_FILE && LOG_CONFIG.FILE_PATH) {
    const logRotator = new LogRotator({
        filePath: LOG_CONFIG.FILE_PATH,
        maxSize: 10 * 1024 * 1024, // 10MB
        maxFiles: 7, // 保留 7 天
    });
    logRotator.start();
    
    // 注册关闭处理器
    processManager.registerShutdownHandler(async () => {
        logRotator.stop();
        performanceMonitor.stopReporting();
    });
}

const port = SERVER_CONFIG.PORT;
loggerInstance.info(`服务器启动成功，监听端口 ${port}`);

export default { port, fetch: app.fetch };