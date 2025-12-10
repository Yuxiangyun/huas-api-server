/**
 * 安全工具模块
 * 提供速率限制、输入验证、数据脱敏等安全功能
 */

import { SECURITY_CONFIG } from '../config';
import loggerInstance from './utils/Logger';

// ========== 速率限制 ==========

/** 速率限制记录 */
interface RateLimitRecord {
    count: number;
    resetTime: number;
}

/** 速率限制存储 (IP -> 记录) */
const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * 速率限制检查器
 * @param key 限制键（通常是 IP + 端点）
 * @param limit 时间窗口内最大请求数
 * @param windowMs 时间窗口（毫秒）
 * @returns 是否允许请求
 */
export function checkRateLimit(key: string, limit: number, windowMs: number = SECURITY_CONFIG.RATE_LIMIT_WINDOW): boolean {
    const now = Date.now();
    const record = rateLimitStore.get(key);
    
    if (!record || now > record.resetTime) {
        // 新记录或已过期，重置
        rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
        return true;
    }
    
    if (record.count >= limit) {
        loggerInstance.warn('速率限制触发', { key: maskString(key), limit });
        return false;
    }
    
    record.count++;
    return true;
}

/**
 * 定期清理过期的速率限制记录
 */
export function cleanupRateLimitStore(): void {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
        if (now > record.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}

// 每5分钟清理一次过期记录
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);

// ========== Token 验证 ==========

/**
 * 验证 Token 格式是否为有效的 UUID v4
 * @param token 待验证的 token
 * @returns 是否有效
 */
export function isValidTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') return false;
    return SECURITY_CONFIG.TOKEN_PATTERN.test(token);
}

// ========== 输入验证 ==========

/** 登录请求参数接口 */
export interface LoginParams {
    sessionId: string;
    username: string;
    password: string;
    code: string;
}

/** 验证结果接口 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * 验证登录请求参数
 * @param params 登录参数
 * @returns 验证结果
 */
export function validateLoginParams(params: any): ValidationResult {
    // 检查必填字段
    if (!params) {
        return { valid: false, error: '请求参数为空' };
    }
    
    const { sessionId, username, password, code } = params;
    
    if (!sessionId || typeof sessionId !== 'string') {
        return { valid: false, error: '会话ID无效' };
    }
    
    if (!isValidTokenFormat(sessionId)) {
        return { valid: false, error: '会话ID格式错误' };
    }
    
    if (!username || typeof username !== 'string') {
        return { valid: false, error: '学号不能为空' };
    }
    
    // 学号格式验证（通常为数字，长度8-12位）
    if (!/^\d{8,12}$/.test(username)) {
        return { valid: false, error: '学号格式错误' };
    }
    
    if (!password || typeof password !== 'string') {
        return { valid: false, error: '密码不能为空' };
    }
    
    if (password.length < 6 || password.length > 50) {
        return { valid: false, error: '密码长度应为6-50位' };
    }
    
    if (!code || typeof code !== 'string') {
        return { valid: false, error: '验证码不能为空' };
    }
    
    // 验证码通常为4位字母数字
    if (!/^[A-Za-z0-9]{4,6}$/.test(code)) {
        return { valid: false, error: '验证码格式错误' };
    }
    
    return { valid: true };
}

// ========== 数据脱敏 ==========

/**
 * 脱敏字符串（保留首尾，中间用*替代）
 * @param str 原始字符串
 * @param showFirst 显示前几位
 * @param showLast 显示后几位
 * @returns 脱敏后的字符串
 */
export function maskString(str: string, showFirst: number = 3, showLast: number = 3): string {
    if (!str || str.length <= showFirst + showLast) {
        return str ? '*'.repeat(str.length) : '';
    }
    
    const first = str.substring(0, showFirst);
    const last = str.substring(str.length - showLast);
    const middle = '*'.repeat(Math.min(str.length - showFirst - showLast, 6));
    
    return `${first}${middle}${last}`;
}

/**
 * 脱敏学号
 * @param studentId 学号
 * @returns 脱敏后的学号
 */
export function maskStudentId(studentId: string): string {
    return maskString(studentId, 4, 2);
}

/**
 * 脱敏 Token
 * @param token Token 字符串
 * @returns 脱敏后的 Token
 */
export function maskToken(token: string): string {
    if (!token || token.length < 8) return '***';
    return token.substring(0, 8) + '...';
}

// ========== 请求上下文 ==========

/**
 * 从请求中提取客户端 IP
 * @param headers 请求头
 * @returns IP 地址
 */
export function getClientIP(headers: Headers): string {
    // 优先使用代理头
    const forwarded = headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0]?.trim() || 'unknown';
    }
    
    const realIP = headers.get('x-real-ip');
    if (realIP) {
        return realIP;
    }
    
    return 'unknown';
}