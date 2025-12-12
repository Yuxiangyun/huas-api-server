/**
 * E2E 测试 - POST /auth/logout
 * 测试登出接口的所有场景
 */
import { describe, test, expect } from 'bun:test';
import { TEST_TOKENS } from '../helpers/MockData';

describe('E2E - POST /auth/logout', () => {
    const BASE_URL = 'http://localhost:3000';

    describe('正常登出', () => {
        test('应该成功处理有效 token 的登出请求', async () => {
            const response = await fetch(`${BASE_URL}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': TEST_TOKENS.VALID
                }
            });
            const data = await response.json();
            
            expect(response.status).toBe(200);
            expect(data.code).toBe(200);
            expect(data.msg).toContain('成功');
        });

        test('应该返回标准响应格式', async () => {
            const response = await fetch(`${BASE_URL}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': TEST_TOKENS.VALID
                }
            });
            const data = await response.json();
            
            expect(data).toHaveProperty('code');
            expect(data).toHaveProperty('msg');
            expect(typeof data.code).toBe('number');
            expect(typeof data.msg).toBe('string');
        });
    });

    describe('幂等性验证', () => {
        test('应该处理无效 token 而不报错', async () => {
            const response = await fetch(`${BASE_URL}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': TEST_TOKENS.INVALID_FORMAT
                }
            });
            const data = await response.json();
            
            // 即使 token 无效也应返回 200（幂等性）
            expect(response.status).toBe(200);
            expect(data.code).toBe(200);
        });

        test('应该处理不存在的 token', async () => {
            const response = await fetch(`${BASE_URL}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': TEST_TOKENS.NON_EXISTENT
                }
            });
            const data = await response.json();
            
            expect(response.status).toBe(200);
            expect(data.code).toBe(200);
        });

        test('应该处理缺失 Authorization 头', async () => {
            const response = await fetch(`${BASE_URL}/auth/logout`, {
                method: 'POST'
            });
            const data = await response.json();
            
            // 即使没有 token 也应返回成功
            expect(response.status).toBe(200);
            expect(data.code).toBe(200);
        });

        test('多次登出应保持幂等性', async () => {
            const token = TEST_TOKENS.VALID;
            
            // 第一次登出
            const response1 = await fetch(`${BASE_URL}/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': token }
            });
            const data1 = await response1.json();
            
            // 第二次登出
            const response2 = await fetch(`${BASE_URL}/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': token }
            });
            const data2 = await response2.json();
            
            // 两次都应该成功
            expect(response1.status).toBe(200);
            expect(response2.status).toBe(200);
            expect(data1.code).toBe(200);
            expect(data2.code).toBe(200);
        });
    });

    describe('HTTP 方法验证', () => {
        test('应该拒绝 GET 请求', async () => {
            const response = await fetch(`${BASE_URL}/auth/logout`);
            expect(response.status).toBe(404);
        });

        test('应该拒绝其他 HTTP 方法', async () => {
            const methods = ['PUT', 'DELETE', 'PATCH'];
            
            for (const method of methods) {
                const response = await fetch(`${BASE_URL}/auth/logout`, { method });
                expect(response.status).toBe(404);
            }
        });
    });

    describe('边界情况', () => {
        test('应该处理空字符串 token', async () => {
            const response = await fetch(`${BASE_URL}/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': '' }
            });
            const data = await response.json();
            
            expect(response.status).toBe(200);
            expect(data.code).toBe(200);
        });

        test('应该处理超长 token', async () => {
            const longToken = 'a'.repeat(1000);
            const response = await fetch(`${BASE_URL}/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': longToken }
            });
            const data = await response.json();
            
            expect(response.status).toBe(200);
            expect(data.code).toBe(200);
        });

        test('应该处理包含特殊字符的 token', async () => {
            const specialToken = '<script>alert("xss")</script>';
            const response = await fetch(`${BASE_URL}/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': specialToken }
            });
            const data = await response.json();
            
            expect(response.status).toBe(200);
            expect(data.code).toBe(200);
        });
    });

    describe('并发登出', () => {
        test('应该正确处理并发登出请求', async () => {
            const concurrentRequests = 10;
            const requests = Array(concurrentRequests).fill(null).map(() =>
                fetch(`${BASE_URL}/auth/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': TEST_TOKENS.VALID }
                })
            );
            
            const responses = await Promise.all(requests);
            const data = await Promise.all(responses.map(r => r.json()));
            
            // 所有请求都应该成功
            responses.forEach(r => expect(r.status).toBe(200));
            data.forEach(d => expect(d.code).toBe(200));
        });
    });
});
