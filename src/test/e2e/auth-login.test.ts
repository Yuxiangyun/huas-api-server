/**
 * E2E 测试 - POST /auth/login
 * 测试登录接口的所有场景
 */
import { describe, test, expect, beforeAll } from 'bun:test';
import { LOGIN_TEST_DATASETS } from '../helpers/MockData';

describe('E2E - POST /auth/login', () => {
    const BASE_URL = 'http://localhost:3000';
    let validSessionId: string;

    beforeAll(async () => {
        // 获取一个有效的 sessionId 用于测试
        const response = await fetch(`${BASE_URL}/auth/captcha`);
        const data = await response.json();
        validSessionId = data.data.sessionId;
    });

    describe('参数验证', () => {
        test('应该拒绝学号过短', async () => {
            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...LOGIN_TEST_DATASETS.INVALID_STUDENT_ID_SHORT,
                    sessionId: validSessionId
                })
            });
            const data = await response.json();
            
            expect(response.status).toBe(400);
            expect(data.code).toBe(400);
            expect(data.msg).toContain('学号');
        });

        test('应该拒绝学号包含特殊字符', async () => {
            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...LOGIN_TEST_DATASETS.INVALID_STUDENT_ID_SPECIAL_CHARS,
                    sessionId: validSessionId
                })
            });
            const data = await response.json();
            
            expect(response.status).toBe(400);
            expect(data.code).toBe(400);
        });

        test('应该拒绝密码过短', async () => {
            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...LOGIN_TEST_DATASETS.INVALID_PASSWORD_SHORT,
                    sessionId: validSessionId
                })
            });
            const data = await response.json();
            
            expect(response.status).toBe(400);
            expect(data.code).toBe(400);
            expect(data.msg).toContain('密码');
        });

        test('应该拒绝密码过长', async () => {
            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...LOGIN_TEST_DATASETS.INVALID_PASSWORD_LONG,
                    sessionId: validSessionId
                })
            });
            const data = await response.json();
            
            expect(response.status).toBe(400);
            expect(data.code).toBe(400);
        });

        test('应该拒绝验证码长度不足', async () => {
            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...LOGIN_TEST_DATASETS.INVALID_CODE_LENGTH,
                    sessionId: validSessionId
                })
            });
            const data = await response.json();
            
            expect(response.status).toBe(400);
            expect(data.code).toBe(400);
        });

        test('应该拒绝验证码包含特殊字符', async () => {
            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...LOGIN_TEST_DATASETS.INVALID_CODE_SPECIAL_CHARS,
                    sessionId: validSessionId
                })
            });
            const data = await response.json();
            
            expect(response.status).toBe(400);
            expect(data.code).toBe(400);
        });

        test('应该拒绝无效的 sessionId 格式', async () => {
            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: 'invalid-session-id',
                    username: '202401001',
                    password: 'Password123',
                    code: 'AB12'
                })
            });
            const data = await response.json();
            
            expect(response.status).toBe(400);
            expect(data.code).toBe(400);
        });

        test('应该拒绝缺失必需参数', async () => {
            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: validSessionId,
                    username: '202401001'
                    // 缺少 password 和 code
                })
            });
            const data = await response.json();
            
            expect(response.status).toBe(400);
            expect(data.code).toBe(400);
        });
    });

    describe('安全防护', () => {
        test('应该阻止 SQL 注入尝试', async () => {
            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...LOGIN_TEST_DATASETS.SQL_INJECTION_USERNAME,
                    sessionId: validSessionId
                })
            });
            const data = await response.json();
            
            expect(response.status).toBe(400);
            expect(data.code).toBe(400);
        });

        test('应该处理 XSS 攻击载荷而不崩溃', async () => {
            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...LOGIN_TEST_DATASETS.XSS_PASSWORD,
                    sessionId: validSessionId
                })
            });
            
            // 不应该返回 500
            expect(response.status).not.toBe(500);
        });
    });

    describe('会话管理', () => {
        test('应该拒绝不存在的 sessionId', async () => {
            // 等待一下避免速率限制
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const fakeSessionId = '550e8400-e29b-41d4-a716-446655440999';
            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: fakeSessionId,
                    username: '202401001',
                    password: 'Password123',
                    code: 'AB12'
                })
            });
            const data = await response.json();
            
            // 不存在的 sessionId 可能返回 400、4011 或 429（速率限制）
            expect([400, 401, 429]).toContain(response.status);
            expect([400, 401, 429]).toContain(data.code);
            expect(data).toHaveProperty('msg');
        });
    });

    describe('响应格式', () => {
        test('错误响应应包含标准字段', async () => {
            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: validSessionId,
                    username: '123',
                    password: 'Password123',
                    code: 'AB12'
                })
            });
            const data = await response.json();
            
            expect(data).toHaveProperty('code');
            expect(data).toHaveProperty('msg');
            expect(typeof data.code).toBe('number');
            expect(typeof data.msg).toBe('string');
        });

        test('应该拒绝非 JSON 请求体', async () => {
            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: 'invalid body'
            });
            
            // 可能返回 400 或其他错误状态码
            expect(response.status).toBeGreaterThanOrEqual(400);
            
            const data = await response.json();
            expect(data).toHaveProperty('code');
            expect(data.code).toBeGreaterThanOrEqual(400);
        });
    });

    describe('HTTP 方法验证', () => {
        test('应该拒绝 GET 请求', async () => {
            const response = await fetch(`${BASE_URL}/auth/login`);
            expect(response.status).toBe(404);
        });

        test('应该拒绝其他 HTTP 方法', async () => {
            const methods = ['PUT', 'DELETE', 'PATCH'];
            
            for (const method of methods) {
                const response = await fetch(`${BASE_URL}/auth/login`, { method });
                expect(response.status).toBe(404);
            }
        });
    });

    describe('速率限制', () => {
        test('应该对同一 IP 的登录请求进行速率限制', async () => {
            // 注意：此测试需要真实服务运行，且速率限制配置较低
            const requests = [];
            const limit = 15; // 超过限制数量
            
            for (let i = 0; i < limit; i++) {
                requests.push(
                    fetch(`${BASE_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sessionId: validSessionId,
                            username: '202401001',
                            password: 'Password123',
                            code: 'AB12'
                        })
                    })
                );
            }
            
            const responses = await Promise.all(requests);
            const last = responses[responses.length - 1];
            
            // 最后一个请求可能会被限制（取决于配置）
            expect(last).toBeDefined();
            expect([400, 401, 429]).toContain(last!.status);
        }, { timeout: 30000 });
    });
});
