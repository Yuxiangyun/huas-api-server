/**
 * 认证路由配置
 * 管理登录、验证码、登出等认证相关路由
 */
import type { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { StudentService } from '../services/StudentService';
import { createRateLimitMiddleware } from '../core/middleware/MiddlewareFactory';
import { isValidTokenFormat, validateLoginParams, maskStudentId, maskToken } from '../core/security';
import { sessionRepo } from '../db/SessionRepo';
import { SECURITY_CONFIG } from '../config';
import loggerInstance from '../core/utils/Logger';

/**
 * 注册所有认证路由
 * @param app Hono 应用实例
 */
export function registerAuthRoutes<E extends { Variables: { userId: string; clientIP: string; } }>(app: Hono<E>) {
    /**
     * 获取验证码
     * 生成新的会话 ID 并返回验证码图片
     */
    app.get('/auth/captcha', 
        createRateLimitMiddleware('captcha', SECURITY_CONFIG.CAPTCHA_RATE_LIMIT),
        async (c) => {
        const clientIP = c.get('clientIP' as any);
        const tempId = uuidv4();
        loggerInstance.info("生成新的验证码会话", { sessionId: maskToken(tempId), ip: clientIP });
        
        try {
            // 创建客户端并获取验证码
            const { HuasClient } = await import('../core/HuasClient');
            const client = new HuasClient(tempId);
            await client.prepareLogin();
            const img = await client.getCaptcha();
            
            // 保存临时会话到数据库
            const state = client.exportState();
            sessionRepo.createTemp(tempId, state.cookies, state.execution || '');
            
            loggerInstance.info("验证码获取成功", { sessionId: maskToken(tempId) });

            return c.json({ 
                code: 200, 
                data: { sessionId: tempId, image: Buffer.from(img).toString('base64') } 
            });
        } catch (e: any) { 
            loggerInstance.error("获取验证码失败", { error: e.message });
            return c.json({ code: 500, msg: "获取验证码失败" }); 
        }
    });

    /**
     * 用户登录
     * 验证学号、密码和验证码
     */
    app.post('/auth/login', 
        createRateLimitMiddleware('login', SECURITY_CONFIG.LOGIN_RATE_LIMIT),
        async (c) => {
        const clientIP = c.get('clientIP' as any);
        
        // 解析请求参数
        let params;
        try {
            params = await c.req.json();
        } catch {
            return c.json({ code: 400, msg: "请求格式错误" }, 400);
        }
        
        // 验证输入参数
        const validation = validateLoginParams(params);
        if (!validation.valid) {
            loggerInstance.warn("登录参数验证失败", { error: validation.error, ip: clientIP });
            return c.json({ code: 400, msg: validation.error }, 400);
        }
        
        const { sessionId, username, password, code } = params;
        
        try {
            loggerInstance.info("用户尝试登录", { username: maskStudentId(username), sessionId: maskToken(sessionId) });
            const service = new StudentService(sessionId);
            const success = await service.login(username, password, code);
            
            if (success) {
                loggerInstance.info("用户登录成功", { username: maskStudentId(username) });
                return c.json({ code: 200, msg: "登录成功", token: sessionId });
            } else {
                loggerInstance.warn("用户登录失败", { username: maskStudentId(username) });
                return c.json({ code: 401, msg: "学号、密码或验证码错误" });
            }
        } catch (e: any) {
            loggerInstance.warn("会话无效或已过期", { sessionId: maskToken(sessionId), error: e?.message || '未知错误' });
            return c.json({ code: 401, msg: "会话无效或已过期，请重新获取验证码" });
        }
    });

    /**
     * 用户退出登录
     * 删除服务端会话
     */
    app.post('/auth/logout', async (c) => {
        const token = c.req.header('Authorization');
        
        if (token && isValidTokenFormat(token)) {
            sessionRepo.delete(token);
            loggerInstance.info("用户退出登录", { token: maskToken(token) });
        }
        
        return c.json({ code: 200, msg: "退出成功" });
    });
}
