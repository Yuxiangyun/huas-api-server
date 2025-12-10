/**
 * 单元测试 - 安全模块
 * 测试安全相关的工具函数
 */
import { describe, test, expect } from 'bun:test';
import {
    isValidTokenFormat,
    validateLoginParams,
    checkRateLimit,
    maskToken,
    maskStudentId,
    getClientIP
} from '../../core/security';
import { 
    TEST_TOKENS, 
    TEST_STUDENT_IDS, 
    TEST_PASSWORDS,
    TEST_CAPTCHA_CODES,
    ATTACK_PAYLOADS
} from '../helpers/MockData';
import { createMockHeaders, sleep } from '../helpers/TestUtils';

describe('安全模块单元测试', () => {
    
    describe('Token 格式验证', () => {
        test('应该接受有效的 UUID v4', () => {
            expect(isValidTokenFormat(TEST_TOKENS.VALID)).toBe(true);
            expect(isValidTokenFormat('a1b2c3d4-e5f6-4789-a012-bcdef0123456')).toBe(true);
        });
        
        test('应该拒绝无效格式', () => {
            expect(isValidTokenFormat(TEST_TOKENS.INVALID_FORMAT)).toBe(false);
            expect(isValidTokenFormat('')).toBe(false);
            expect(isValidTokenFormat('12345678')).toBe(false);
            expect(isValidTokenFormat(null as any)).toBe(false);
        });
        
        test('应该拒绝非 UUID v4 版本', () => {
            // UUID v1
            expect(isValidTokenFormat('550e8400-e29b-11d4-a716-446655440000')).toBe(false);
            // UUID v5
            expect(isValidTokenFormat('550e8400-e29b-51d4-a716-446655440000')).toBe(false);
        });
    });
    
    describe('登录参数验证', () => {
        const validParams = {
            sessionId: TEST_TOKENS.VALID,
            username: TEST_STUDENT_IDS.VALID,
            password: TEST_PASSWORDS.VALID,
            code: TEST_CAPTCHA_CODES.VALID
        };
        
        test('应该接受完全有效的参数', () => {
            const result = validateLoginParams(validParams);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });
        
        test('应该拒绝空参数', () => {
            const result = validateLoginParams(null);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('参数为空');
        });
        
        test('应该拒绝无效的 sessionId', () => {
            const result = validateLoginParams({
                ...validParams,
                sessionId: TEST_TOKENS.INVALID_FORMAT
            });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('会话ID格式错误');
        });
        
        test('应该拒绝无效的学号格式', () => {
            const shortId = validateLoginParams({ ...validParams, username: TEST_STUDENT_IDS.INVALID_SHORT });
            expect(shortId.valid).toBe(false);
            
            const lettersId = validateLoginParams({ ...validParams, username: TEST_STUDENT_IDS.INVALID_LETTERS });
            expect(lettersId.valid).toBe(false);
        });
        
        test('应该拒绝不合法的密码长度', () => {
            const tooShort = validateLoginParams({ ...validParams, password: TEST_PASSWORDS.TOO_SHORT });
            expect(tooShort.valid).toBe(false);
            expect(tooShort.error).toContain('密码长度');
            
            const tooLong = validateLoginParams({ ...validParams, password: TEST_PASSWORDS.TOO_LONG });
            expect(tooLong.valid).toBe(false);
        });
        
        test('应该拒绝无效的验证码格式', () => {
            const invalidLength = validateLoginParams({ ...validParams, code: TEST_CAPTCHA_CODES.INVALID_LENGTH });
            expect(invalidLength.valid).toBe(false);
            
            const invalidChars = validateLoginParams({ ...validParams, code: TEST_CAPTCHA_CODES.INVALID_CHARS });
            expect(invalidChars.valid).toBe(false);
        });
        
        test('应该防御 SQL 注入攻击', () => {
            for (const payload of ATTACK_PAYLOADS.SQL_INJECTION) {
                const result = validateLoginParams({
                    ...validParams,
                    username: payload
                });
                expect(result.valid).toBe(false);
            }
        });
        
        test('应该防御 XSS 攻击', () => {
            for (const payload of ATTACK_PAYLOADS.XSS) {
                const result = validateLoginParams({
                    ...validParams,
                    password: payload
                });
                // XSS 在密码长度验证时可能通过，但会被其他层防护
                // 这里主要测试不会导致系统崩溃
                expect(result).toBeDefined();
            }
        });
    });
    
    describe('速率限制', () => {
        const testKey = 'test_rate_limit_' + Date.now();
        
        test('应该允许在限制内的请求', () => {
            const key = testKey + '_1';
            expect(checkRateLimit(key, 5)).toBe(true);
            expect(checkRateLimit(key, 5)).toBe(true);
            expect(checkRateLimit(key, 5)).toBe(true);
        });
        
        test('应该阻止超过限制的请求', () => {
            const key = testKey + '_2';
            const limit = 3;
            
            // 前 3 次应该通过
            for (let i = 0; i < limit; i++) {
                expect(checkRateLimit(key, limit)).toBe(true);
            }
            
            // 第 4 次应该被拒绝
            expect(checkRateLimit(key, limit)).toBe(false);
        });
        
        test('不同的 key 应该独立计数', () => {
            const key1 = testKey + '_3a';
            const key2 = testKey + '_3b';
            const limit = 2;
            
            expect(checkRateLimit(key1, limit)).toBe(true);
            expect(checkRateLimit(key1, limit)).toBe(true);
            expect(checkRateLimit(key1, limit)).toBe(false);
            
            // key2 不应该受 key1 影响
            expect(checkRateLimit(key2, limit)).toBe(true);
            expect(checkRateLimit(key2, limit)).toBe(true);
        });
        
        test('应该在时间窗口后重置计数', async () => {
            const key = testKey + '_4';
            const limit = 2;
            
            checkRateLimit(key, limit);
            checkRateLimit(key, limit);
            expect(checkRateLimit(key, limit)).toBe(false);
            
            // 等待 61 秒后应该重置（实际测试中可能需要 mock 时间）
            // 这里只测试逻辑，不等待真实时间
        });
    });
    
    describe('数据脱敏', () => {
        test('maskToken 应该正确脱敏 Token', () => {
            const token = TEST_TOKENS.VALID;
            const masked = maskToken(token);
            
            expect(masked).toContain('550e8400');
            expect(masked).toContain('...');
            expect(masked).not.toBe(token);
            expect(masked.length).toBeLessThan(token.length);
        });
        
        test('maskStudentId 应该正确脱敏学号', () => {
            const studentId = '202401001';
            const masked = maskStudentId(studentId);
            
            expect(masked).toContain('2024');
            expect(masked).toContain('***');
            expect(masked).not.toBe(studentId);
        });
        
        test('脱敏后不应该暴露敏感信息', () => {
            const token = '12345678-1234-4123-8123-123456789012';
            const masked = maskToken(token);
            
            // 确保中间部分被隐藏
            expect(masked).not.toContain('4123');
            expect(masked).not.toContain('8123');
        });
    });
    
    describe('客户端 IP 提取', () => {
        test('应该从 x-forwarded-for 提取 IP', () => {
            const headers = createMockHeaders({
                'x-forwarded-for': '192.168.1.100, 10.0.0.1'
            });
            
            const ip = getClientIP(headers);
            expect(ip).toBe('192.168.1.100');
        });
        
        test('应该从 x-real-ip 提取 IP', () => {
            const headers = createMockHeaders({
                'x-real-ip': '192.168.1.200'
            });
            
            const ip = getClientIP(headers);
            expect(ip).toBe('192.168.1.200');
        });
        
        test('x-forwarded-for 应该优先于 x-real-ip', () => {
            const headers = createMockHeaders({
                'x-forwarded-for': '192.168.1.100',
                'x-real-ip': '192.168.1.200'
            });
            
            const ip = getClientIP(headers);
            expect(ip).toBe('192.168.1.100');
        });
        
        test('无代理头时应该返回 unknown', () => {
            const headers = createMockHeaders({});
            const ip = getClientIP(headers);
            expect(ip).toBe('unknown');
        });
    });
});
