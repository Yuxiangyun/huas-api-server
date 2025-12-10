/**
 * 测试工具函数
 * 提供测试所需的通用工具和辅助函数
 */
import { v4 as uuidv4 } from 'uuid';
import type { DbSession } from '../../types';

/**
 * 等待指定时间
 * @param ms 毫秒数
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 生成测试用的 UUID Token
 */
export function generateTestToken(): string {
    return uuidv4();
}

/**
 * 创建测试会话对象
 */
export function createTestSession(overrides?: Partial<DbSession>): DbSession {
    return {
        token: generateTestToken(),
        student_id: '202401001',
        cookies: 'JSESSIONID=TEST123',
        execution: '',
        portal_token: 'portal_test_token',
        user_agent: null,
        created_at: Date.now(),
        updated_at: Date.now(),
        ...overrides
    };
}

/**
 * 创建临时测试会话
 */
export function createTempTestSession(): DbSession {
    return {
        token: generateTestToken(),
        student_id: null,
        cookies: 'JSESSIONID=TEMP123',
        execution: 'e1s1',
        portal_token: null,
        user_agent: null,
        created_at: Date.now(),
        updated_at: Date.now()
    };
}

/**
 * 模拟 HTTP Headers
 */
export function createMockHeaders(overrides?: Record<string, string>): Headers {
    const headers = new Headers({
        'Content-Type': 'application/json',
        'User-Agent': 'Test-Agent/1.0',
        ...overrides
    });
    return headers;
}

/**
 * 生成随机字符串
 */
export function randomString(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * 生成随机数字
 */
export function randomNumber(min: number = 0, max: number = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 测试数据库清理
 * 清理测试产生的数据
 */
export async function cleanupTestData(db: any) {
    try {
        // 清理测试会话
        db.run("DELETE FROM sessions WHERE student_id LIKE 'test_%'");
        // 清理测试缓存
        db.run("DELETE FROM data_cache WHERE student_id LIKE 'test_%'");
        // 清理测试用户
        db.run("DELETE FROM users WHERE student_id LIKE 'test_%'");
    } catch (e) {
        console.warn('清理测试数据失败:', e);
    }
}

/**
 * 断言抛出错误
 */
export async function expectToThrow(
    fn: () => Promise<any>,
    expectedError?: string | RegExp
): Promise<void> {
    let threw = false;
    let actualError: any;
    
    try {
        await fn();
    } catch (e) {
        threw = true;
        actualError = e;
    }
    
    if (!threw) {
        throw new Error('Expected function to throw an error, but it did not');
    }
    
    if (expectedError) {
        const errorMessage = actualError?.message || String(actualError);
        if (typeof expectedError === 'string') {
            if (!errorMessage.includes(expectedError)) {
                throw new Error(`Expected error to contain "${expectedError}", but got: ${errorMessage}`);
            }
        } else {
            if (!expectedError.test(errorMessage)) {
                throw new Error(`Expected error to match ${expectedError}, but got: ${errorMessage}`);
            }
        }
    }
}

/**
 * 测量函数执行时间
 */
export async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
}

/**
 * 重试函数（用于不稳定的测试）
 */
export async function retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    delay: number = 100
): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (e) {
            lastError = e;
            if (attempt < maxAttempts) {
                await sleep(delay * attempt);
            }
        }
    }
    
    throw lastError;
}

/**
 * 并发执行多个任务
 */
export async function concurrent<T>(
    tasks: Array<() => Promise<T>>,
    concurrency: number = 10
): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];
    
    for (const task of tasks) {
        const p = task().then(result => {
            results.push(result);
        });
        
        executing.push(p);
        
        if (executing.length >= concurrency) {
            await Promise.race(executing);
            executing.splice(executing.findIndex(e => e === p), 1);
        }
    }
    
    await Promise.all(executing);
    return results;
}

/**
 * Mock fetch 响应
 */
export function createMockResponse(
    body: any,
    options?: {
        status?: number;
        headers?: Record<string, string>;
    }
): Response {
    const { status = 200, headers = {} } = options || {};
    
    return new Response(
        typeof body === 'string' ? body : JSON.stringify(body),
        {
            status,
            headers: new Headers(headers)
        }
    );
}

/**
 * 统计测试覆盖的功能点
 */
export class TestCoverageTracker {
    private covered = new Set<string>();
    
    mark(feature: string) {
        this.covered.add(feature);
    }
    
    getCoverage(): string[] {
        return Array.from(this.covered).sort();
    }
    
    report(): string {
        const features = this.getCoverage();
        return `测试覆盖 ${features.length} 个功能点:\n${features.map(f => `  ✓ ${f}`).join('\n')}`;
    }
}
