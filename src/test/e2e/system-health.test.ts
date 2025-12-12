/**
 * E2E 测试 - GET /system/health
 * 测试健康检查接口
 */
import { describe, test, expect } from 'bun:test';

describe('E2E - GET /system/health', () => {
    const BASE_URL = 'http://localhost:3000';

    describe('正常请求', () => {
        test('应该返回 200 和健康状态', async () => {
            const response = await fetch(`${BASE_URL}/system/health`);
            const data = await response.json();
            
            expect(response.status).toBe(200);
            expect(data.code).toBe(200);
            expect(data.data).toHaveProperty('status');
            expect(data.data.status).toBe('healthy');
        });

        test('应该包含时间戳', async () => {
            const response = await fetch(`${BASE_URL}/system/health`);
            const data = await response.json();
            
            expect(data.data).toHaveProperty('timestamp');
            expect(typeof data.data.timestamp).toBe('number');
            expect(data.data.timestamp).toBeGreaterThan(0);
        });

        test('应该包含运行时长', async () => {
            const response = await fetch(`${BASE_URL}/system/health`);
            const data = await response.json();
            
            expect(data.data).toHaveProperty('uptime');
            expect(typeof data.data.uptime).toBe('number');
            expect(data.data.uptime).toBeGreaterThanOrEqual(0);
        });

        test('时间戳应该接近当前时间', async () => {
            const before = Date.now();
            const response = await fetch(`${BASE_URL}/system/health`);
            const after = Date.now();
            const data = await response.json();
            
            expect(data.data.timestamp).toBeGreaterThanOrEqual(before);
            expect(data.data.timestamp).toBeLessThanOrEqual(after);
        });
    });

    describe('响应格式', () => {
        test('应该符合标准响应格式', async () => {
            const response = await fetch(`${BASE_URL}/system/health`);
            const data = await response.json();
            
            expect(data).toHaveProperty('code');
            expect(data).toHaveProperty('data');
            expect(typeof data.code).toBe('number');
            expect(typeof data.data).toBe('object');
        });

        test('响应 Content-Type 应该是 JSON', async () => {
            const response = await fetch(`${BASE_URL}/system/health`);
            const contentType = response.headers.get('content-type');
            
            expect(contentType).toContain('application/json');
        });
    });

    describe('HTTP 方法验证', () => {
        test('应该拒绝 POST 请求', async () => {
            const response = await fetch(`${BASE_URL}/system/health`, {
                method: 'POST'
            });
            
            expect(response.status).toBe(404);
        });

        test('应该拒绝其他 HTTP 方法', async () => {
            const methods = ['PUT', 'DELETE', 'PATCH'];
            
            for (const method of methods) {
                const response = await fetch(`${BASE_URL}/system/health`, { method });
                expect(response.status).toBe(404);
            }
        });
    });

    describe('并发请求', () => {
        test('应该正确处理并发健康检查请求', async () => {
            const concurrentRequests = 20;
            const requests = Array(concurrentRequests).fill(null).map(() =>
                fetch(`${BASE_URL}/system/health`)
            );
            
            const responses = await Promise.all(requests);
            const data = await Promise.all(responses.map(r => r.json()));
            
            // 所有请求都应该成功
            responses.forEach(r => expect(r.status).toBe(200));
            data.forEach(d => {
                expect(d.code).toBe(200);
                expect(d.data.status).toBe('healthy');
            });
        });
    });

    describe('边界情况', () => {
        test('应该处理带查询参数的请求', async () => {
            const response = await fetch(`${BASE_URL}/system/health?extra=param`);
            const data = await response.json();
            
            // 额外的查询参数应该被忽略
            expect(response.status).toBe(200);
            expect(data.data.status).toBe('healthy');
        });

        test('多次请求的 uptime 应该递增', async () => {
            const response1 = await fetch(`${BASE_URL}/system/health`);
            const data1 = await response1.json();
            const uptime1 = data1.data.uptime;
            
            // 等待一小段时间
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const response2 = await fetch(`${BASE_URL}/system/health`);
            const data2 = await response2.json();
            const uptime2 = data2.data.uptime;
            
            // 第二次的运行时长应该大于第一次
            expect(uptime2).toBeGreaterThanOrEqual(uptime1);
        });
    });

    describe('可用性监控', () => {
        test('响应时间应该在合理范围内', async () => {
            const start = Date.now();
            const response = await fetch(`${BASE_URL}/system/health`);
            const end = Date.now();
            const duration = end - start;
            
            expect(response.status).toBe(200);
            // 健康检查应该在 500ms 内响应
            expect(duration).toBeLessThan(500);
        });

        test('连续多次请求应该稳定返回健康状态', async () => {
            const count = 10;
            const results = [];
            
            for (let i = 0; i < count; i++) {
                const response = await fetch(`${BASE_URL}/system/health`);
                const data = await response.json();
                results.push(data.data.status);
            }
            
            // 所有请求都应该返回 healthy
            expect(results.every(status => status === 'healthy')).toBe(true);
        });
    });
});
