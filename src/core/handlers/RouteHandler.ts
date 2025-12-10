/**
 * 路由处理器抽象层
 * 提供统一的路由处理、错误封装、响应格式化
 */
import type { Context } from 'hono';
import { SessionExpiredError } from '../utils/errors';
import loggerInstance from '../utils/Logger';

/** API 响应接口 */
export interface ApiResponse<T = any> {
    code: number;
    data?: T;
    msg?: string;
    action?: string;
}

/** 路由处理器函数类型 */
export type RouteAction<T = any> = () => Promise<T>;

/**
 * 路由处理器基类
 * 封装通用的错误处理和响应格式化逻辑
 */
export class RouteHandler {
    /**
     * 安全执行路由处理函数
     * 统一处理异常和响应格式
     * 
     * @param c Hono 上下文
     * @param action 业务逻辑函数
     * @returns JSON 响应
     */
    static async handle<T>(c: Context, action: RouteAction<T>) {
        try {
            const data = await action();
            return RouteHandler.success(c, data);
        } catch (e: any) {
            return RouteHandler.handleError(c, e);
        }
    }
    
    /**
     * 成功响应
     * @param c Hono 上下文
     * @param data 响应数据
     */
    static success<T>(c: Context, data: T) {
        const response: ApiResponse<T> = {
            code: 200,
            data
        };
        return c.json(response);
    }
    
    /**
     * 错误响应
     * @param c Hono 上下文
     * @param code HTTP 状态码
     * @param msg 错误消息
     * @param action 建议操作（可选）
     */
    static error(c: Context, code: number, msg: string, action?: string) {
        const response: ApiResponse = {
            code,
            msg,
            action
        };
        return c.json(response, code as any);
    }
    
    /**
     * 处理各类异常
     * @param c Hono 上下文
     * @param e 异常对象
     */
    private static handleError(c: Context, e: any) {
        // 会话过期错误
        if (e instanceof SessionExpiredError) {
            loggerInstance.warn("会话已过期", { error: e.message });
            return RouteHandler.error(
                c, 
                401, 
                "登录凭证已失效，请重新登录", 
                "RELOGIN"
            );
        }
        
        // 其他错误
        loggerInstance.error("服务器内部错误", { 
            error: e.message,
            stack: e.stack 
        });
        
        return RouteHandler.error(c, 500, "服务器内部错误");
    }
}

/**
 * 创建路由处理器的便捷函数
 * @param action 业务逻辑函数
 * @returns Hono 路由处理函数
 */
export function createHandler<T>(action: (c: Context) => Promise<T>) {
    return (c: Context) => RouteHandler.handle(c, () => action(c));
}
