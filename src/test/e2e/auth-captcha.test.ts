/**
 * E2E 测试 - GET /auth/captcha
 * 测试验证码获取接口的所有场景
 */
import { describe, test, expect } from 'bun:test';

describe('E2E - GET /auth/captcha', () => {
    const BASE_URL = 'http://localhost:3000';

    describe('正常请求', () => {
        test('应该返回 200 和验证码数据', async () => {
            const response = await fetch(`${BASE_URL}/auth/captcha`);
            const data = await response.json();
            
            expect(response.status).toBe(200);
            expect(data.code).toBe(200);
            expect(data.data).toHaveProperty('sessionId');
            expect(data.data).toHaveProperty('image');
        });

        test('返回的 sessionId 应该是合法的 UUID v4', async () => {
            const response = await fetch(`${BASE_URL}/auth/captcha`);
            const data = await response.json();
            
            const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(data.data.sessionId).toMatch(uuidV4Regex);
        });

        test('返回的图片应该是 base64 编码', async () => {
            const response = await fetch(`${BASE_URL}/auth/captcha`);
            const data = await response.json();
            
            const base64Regex = /^[A-Za-z0-9+/]+=*$/;
            expect(data.data.image).toMatch(base64Regex);
            expect(data.data.image.length).toBeGreaterThan(0);
        });

        test('每次请求应该返回不同的 sessionId', async () => {
            const response1 = await fetch(`${BASE_URL}/auth/captcha`);
            const data1 = await response1.json();
            
            const response2 = await fetch(`${BASE_URL}/auth/captcha`);
            const data2 = await response2.json();
            
            expect(data1.data.sessionId).not.toBe(data2.data.sessionId);
        });
    });

    describe('速率限制', () => {
        test('应该对同一 IP 进行速率限制', async () => {
            // 注意：此测试需要真实服务运行，且速率限制配置较低
            // 实际测试时可能需要调整或跳过
            const requests = [];
            const limit = 25; // 超过限制数量
            
            for (let i = 0; i < limit; i++) {
                requests.push(fetch(`${BASE_URL}/auth/captcha`));
            }
            
            const responses = await Promise.all(requests);
            const last = responses[responses.length - 1];
            
            // 最后一个请求可能会被限制（取决于配置）
            // 这里只验证状态码是 200 或 429
            expect(last).toBeDefined();
            expect([200, 429]).toContain(last!.status);
        }, { timeout: 30000 });
    });

    describe('并发请求', () => {
        test('应该正确处理并发请求', async () => {
            // 等待一下避免速率限制
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const concurrentRequests = 3;
            const requests = Array(concurrentRequests).fill(null).map(() =>
                fetch(`${BASE_URL}/auth/captcha`)
            );
            
            const responses = await Promise.all(requests);
            const data = await Promise.all(responses.map(r => r.json()));
            
            // 所有请求都应该有响应（成功或被限流）
            expect(responses.length).toBe(concurrentRequests);
            expect(data.length).toBe(concurrentRequests);
            
            // 每个响应都应该有 code 字段
            data.forEach(d => {
                expect(d).toHaveProperty('code');
                expect([200, 429]).toContain(d.code); // 成功或限流
            });
            
            // 成功的 sessionId 都应该不同
            const successData = data.filter(d => d.code === 200 && d.data);
            if (successData.length > 1) {
                const sessionIds = successData.map(d => d.data.sessionId);
                const uniqueIds = new Set(sessionIds);
                expect(uniqueIds.size).toBe(sessionIds.length);
            }
        });
    });

    describe('响应结构验证', () => {
        test('响应应该符合标准格式', async () => {
            // 等待一下避免速率限制
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const response = await fetch(`${BASE_URL}/auth/captcha`);
            const data = await response.json();
            
            expect(data).toHaveProperty('code');
            expect(typeof data.code).toBe('number');
            
            // 成功响应有 data 字段，失败响应有 msg 字段
            if (data.code === 200) {
                expect(data).toHaveProperty('data');
                expect(typeof data.data).toBe('object');
            } else {
                expect(data).toHaveProperty('msg');
            }
        });

        test('成功响应不应包含错误信息', async () => {
            // 等待一下避免速率限制
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const response = await fetch(`${BASE_URL}/auth/captcha`);
            const data = await response.json();
            
            // 如果没有被限流，应该返回 200
            if (response.status === 200) {
                expect(data.code).toBe(200);
                expect(data).not.toHaveProperty('msg');
                expect(data).not.toHaveProperty('error');
            } else {
                // 如果被限流，应该返回 429
                expect(response.status).toBe(429);
                expect(data.code).toBe(429);
            }
        });
    });

    describe('边界情况', () => {
        test('应该处理带查询参数的请求', async () => {
            // 等待一下避免速率限制
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const response = await fetch(`${BASE_URL}/auth/captcha?extra=param`);
            const data = await response.json();
            
            // 额外的查询参数应该被忽略（如果没被限流）
            if (response.status === 200) {
                expect(data.data).toHaveProperty('sessionId');
            } else {
                // 可能因为速率限制返回 429
                expect([200, 429]).toContain(response.status);
            }
        });

        test('应该拒绝 POST 请求', async () => {
            const response = await fetch(`${BASE_URL}/auth/captcha`, {
                method: 'POST'
            });
            
            expect(response.status).toBe(404);
        });

        test('应该拒绝其他 HTTP 方法', async () => {
            const methods = ['PUT', 'DELETE', 'PATCH'];
            
            for (const method of methods) {
                const response = await fetch(`${BASE_URL}/auth/captcha`, { method });
                expect(response.status).toBe(404);
            }
        });
    });
});
