/**
 * 中间件工厂
 * 提供可配置的中间件生成器，方便复用和扩展
 */
import type { Context, Next } from 'hono';
import { checkRateLimit, isValidTokenFormat, maskToken, getClientIP, maskStudentId } from '../security';
import { sessionRepo } from '../../db/SessionRepo';
import { performanceMonitor } from '../utils/PerformanceMonitor';
import loggerInstance from '../utils/Logger';

/**
 * 创建性能监控中间件
 * 记录请求响应时间和状态
 */
export function createPerformanceMiddleware() {
    return async (c: Context, next: Next) => {
        const start = Date.now();
        const clientIP = getClientIP(c.req.raw.headers);
        c.set('clientIP', clientIP);
        
        let success = true;
        try {
            await next();
            if (c.res.status >= 400) {
                success = false;
            }
        } catch (e) {
            success = false;
            throw e;
        } finally {
            const ms = Date.now() - start;
            performanceMonitor.recordRequest(ms, success);
            loggerInstance.info(`${c.req.method} ${c.req.path} - ${ms}ms`, { 
                status: c.res.status,
                ip: clientIP
            });
        }
    };
}

/**
 * 创建认证中间件
 * 验证 Token 格式和有效性
 * 
 * @param options 配置选项
 * @returns 认证中间件
 */
export function createAuthMiddleware(options?: {
    /** 是否启用速率限制 */
    enableRateLimit?: boolean;
    /** 速率限制（次/分钟） */
    rateLimit?: number;
}) {
    const { enableRateLimit = true, rateLimit = 60 } = options || {};
    
    return async (c: Context, next: Next) => {
        const token = c.req.header('Authorization');
        const clientIP = c.get('clientIP');
        
        // 检查 Token 是否存在
        if (!token) {
            loggerInstance.warn("未授权访问尝试", { path: c.req.path, ip: clientIP });
            return c.json({ code: 401, msg: "未授权" }, 401 as any);
        }
        
        // 验证 Token 格式
        if (!isValidTokenFormat(token)) {
            loggerInstance.warn("无效的 Token 格式", { token: maskToken(token), ip: clientIP });
            return c.json({ code: 401, msg: "Token 格式无效" }, 401 as any);
        }
        
        // 验证 Token 是否存在于数据库
        const session = sessionRepo.get(token);
        if (!session) {
            loggerInstance.warn("会话不存在", { token: maskToken(token), ip: clientIP });
            return c.json({ code: 401, msg: "会话已过期，请重新登录" }, 401 as any);
        }
        
        // 速率限制
        if (enableRateLimit) {
            const rateLimitKey = `api:${clientIP}`;
            if (!checkRateLimit(rateLimitKey, rateLimit)) {
                loggerInstance.warn("API 速率限制触发", { ip: clientIP, path: c.req.path });
                return c.json({ code: 429, msg: "请求过于频繁，请稍后再试" }, 429 as any);
            }
        }
        
        // 重要：这里设置的是 token，不是 student_id
        // token 会在 StudentService 中通过会话查询获取对应的 student_id
        // 这样保证了数据隔离：每个 token 只能访问其绑定的用户数据
        c.set('userId', token);
        await next();
    };
}

/**
 * 创建速率限制中间件
 * 
 * @param prefix 限制键前缀
 * @param limit 限制次数
 * @returns 速率限制中间件
 */
export function createRateLimitMiddleware(prefix: string, limit: number) {
    return async (c: Context, next: Next) => {
        const clientIP = c.get('clientIP') || getClientIP(c.req.raw.headers);
        const rateLimitKey = `${prefix}:${clientIP}`;
        
        if (!checkRateLimit(rateLimitKey, limit)) {
            loggerInstance.warn("速率限制触发", { 
                prefix, 
                limit, 
                ip: clientIP,
                path: c.req.path 
            });
            return c.json({ 
                code: 429, 
                msg: "请求过于频繁，请稍后再试" 
            }, 429 as any);
        }
        
        await next();
    };
}

/**
 * 创建日志中间件
 * 
 * @param options 配置选项
 * @returns 日志中间件
 */
export function createLoggerMiddleware(options?: {
    /** 是否记录请求体 */
    logBody?: boolean;
    /** 是否记录响应 */
    logResponse?: boolean;
}) {
    const { logBody = false, logResponse = false } = options || {};
    
    return async (c: Context, next: Next) => {
        const startTime = Date.now();
        const method = c.req.method;
        const path = c.req.path;
        const clientIP = getClientIP(c.req.raw.headers);
        
        // 记录请求
        const logData: any = {
            method,
            path,
            ip: clientIP,
            userAgent: c.req.header('user-agent')
        };
        
        if (logBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
            try {
                logData.body = await c.req.json();
            } catch {
                // 忽略解析错误
            }
        }
        
        loggerInstance.debug("收到请求", logData);
        
        await next();
        
        // 记录响应
        const duration = Date.now() - startTime;
        const responseLog: any = {
            method,
            path,
            status: c.res.status,
            duration: `${duration}ms`
        };
        
        if (logResponse) {
            // 注意：读取响应体可能影响性能
            try {
                responseLog.response = await c.res.clone().json();
            } catch {
                // 忽略解析错误
            }
        }
        
        loggerInstance.debug("请求完成", responseLog);
    };
}

/**
 * 创建管理员认证中间件
 * 验证用户是否为系统管理员
 * 
 * @returns 管理员认证中间件
 */
export function createAdminAuthMiddleware() {
    // 管理员学号白名单
    const ADMIN_STUDENT_IDS = new Set<string>(['202412040130']);

    return async (c: Context, next: Next) => {
        const token = c.req.header('Authorization');
        const clientIP = c.get('clientIP');

        // Token 存在性检查
        if (!token) {
            loggerInstance.warn("管理员接口未授权访问尝试", { path: c.req.path, ip: clientIP });
            return c.json({ code: 401, msg: "未授权" }, 401 as any);
        }

        // Token 格式验证
        if (!isValidTokenFormat(token)) {
            loggerInstance.warn("管理员接口收到无效 Token 格式", { token: maskToken(token), ip: clientIP });
            return c.json({ code: 401, msg: "Token 格式无效" }, 401 as any);
        }

        // 会话验证
        const session = sessionRepo.get(token);
        if (!session || !session.student_id) {
            loggerInstance.warn("管理员接口会话不存在或未绑定用户", { token: maskToken(token), ip: clientIP });
            return c.json({ code: 401, msg: "会话已过期或未登录" }, 401 as any);
        }

        const studentId = session.student_id as string;

        // 管理员身份校验
        if (!ADMIN_STUDENT_IDS.has(studentId)) {
            loggerInstance.warn("非管理员访问管理员接口被拒绝", { 
                studentId: maskStudentId(studentId), 
                ip: clientIP, 
                path: c.req.path 
            });
            return c.json({ code: 403, msg: "仅管理员可访问" }, 403 as any);
        }

        // 管理员接口速率限制
        const rateLimitKey = `admin:${studentId}`;
        if (!checkRateLimit(rateLimitKey, 100)) { // 管理员限流稍宽松
            loggerInstance.warn("管理员接口速率限制触发", { 
                studentId: maskStudentId(studentId), 
                ip: clientIP, 
                path: c.req.path 
            });
            return c.json({ code: 429, msg: "请求过于频繁，请稍后再试" }, 429 as any);
        }

        // 在上下文里标记管理员身份
        c.set('userId', studentId);
        loggerInstance.info("管理员访问系统接口", { 
            studentId: maskStudentId(studentId), 
            path: c.req.path 
        });
        
        await next();
    };
}
