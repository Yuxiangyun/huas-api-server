/**
 * 集成测试 - SessionRepo
 * 测试会话仓储的所有功能点
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { SessionRepo } from '../../db/SessionRepo';
import { db } from '../../db';
import { generateTestToken } from '../helpers/TestUtils';

describe('SessionRepo 集成测试', () => {
    let repo: SessionRepo;
    let testTokens: string[] = [];

    beforeEach(() => {
        repo = new SessionRepo();
    });

    afterEach(() => {
        // 清理测试数据
        testTokens.forEach(token => {
            db.run("DELETE FROM sessions WHERE token = ?", [token]);
        });
        testTokens = [];
    });

    describe('创建临时会话', () => {
        test('应该成功创建临时会话', () => {
            const token = generateTestToken();
            testTokens.push(token);
            
            repo.createTemp(token, { testCookie: 'value' }, 'exec-123');
            
            const session = repo.get(token);
            expect(session).not.toBeNull();
            expect(session?.token).toBe(token);
            expect(session?.student_id).toBeNull();
            expect(session?.execution).toBe('exec-123');
        });

        test('应该正确存储 cookies', () => {
            const token = generateTestToken();
            testTokens.push(token);
            const cookies = { JSESSIONID: 'ABC123', CASTGC: 'TGT-456' };
            
            repo.createTemp(token, cookies, 'exec');
            
            const session = repo.get(token);
            // cookies 是解析后的对象
            expect(session?.cookies).toHaveProperty('JSESSIONID');
            expect(session?.cookies?.JSESSIONID).toBe('ABC123');
        });

        test('应该正确存储 execution', () => {
            const token = generateTestToken();
            testTokens.push(token);
            
            repo.createTemp(token, {}, 'e1s2t3');
            
            const session = repo.get(token);
            expect(session?.execution).toBe('e1s2t3');
        });

        test('临时会话的 portal_token 应为 null', () => {
            const token = generateTestToken();
            testTokens.push(token);
            
            repo.createTemp(token, {}, 'exec');
            
            const session = repo.get(token);
            expect(session?.portal_token).toBeNull();
        });
    });

    describe('绑定用户', () => {
        test('应该成功绑定学号到会话', () => {
            const token = generateTestToken();
            testTokens.push(token);
            const studentId = `test_${Date.now()}`;
            
            repo.createTemp(token, { temp: 'cookie' }, 'exec-1');
            repo.bindUser(token, studentId, { auth: 'cookie' }, 'portal-token-123');
            
            const session = repo.get(token);
            expect(session?.student_id).toBe(studentId);
            expect(session?.portal_token).toBe('portal-token-123');
        });

        test('绑定用户后应清空 execution', () => {
            const token = generateTestToken();
            testTokens.push(token);
            
            repo.createTemp(token, {}, 'exec-should-clear');
            repo.bindUser(token, 'test_student', {}, 'portal-token');
            
            const session = repo.get(token);
            expect(session?.execution).toBeNull();
        });

        test('绑定用户后应更新 cookies', () => {
            const token = generateTestToken();
            testTokens.push(token);
            const newCookies = { JSESSIONID: 'NEW_SESSION' };
            
            repo.createTemp(token, { old: 'cookie' }, 'exec');
            repo.bindUser(token, 'test_student', newCookies, 'portal');
            
            const session = repo.get(token);
            // cookies 是解析后的对象
            expect(session?.cookies?.JSESSIONID).toBe('NEW_SESSION');
        });

        test('应该更新 updated_at 时间戳', () => {
            const token = generateTestToken();
            testTokens.push(token);
            
            repo.createTemp(token, {}, 'exec');
            const beforeTime = Date.now();
            
            repo.bindUser(token, 'test_student', {}, 'portal');
            
            const session = repo.get(token);
            expect(session?.updated_at).toBeGreaterThanOrEqual(beforeTime);
        });
    });

    describe('查询会话', () => {
        test('应该返回存在的会话', () => {
            const token = generateTestToken();
            testTokens.push(token);
            
            repo.createTemp(token, {}, 'exec');
            
            const session = repo.get(token);
            expect(session).not.toBeNull();
        });

        test('查询不存在的会话应返回 null', () => {
            const nonExistentToken = generateTestToken();
            
            const session = repo.get(nonExistentToken);
            expect(session).toBeNull();
        });

        test('应该返回完整的会话数据结构', () => {
            const token = generateTestToken();
            testTokens.push(token);
            const studentId = 'test_complete';
            
            repo.createTemp(token, { cookie: 'value' }, 'exec');
            repo.bindUser(token, studentId, {}, 'portal');
            
            const session = repo.get(token);
            expect(session).toHaveProperty('token');
            expect(session).toHaveProperty('student_id');
            expect(session).toHaveProperty('cookies');
            expect(session).toHaveProperty('execution');
            expect(session).toHaveProperty('portal_token');
            expect(session).toHaveProperty('created_at');
            expect(session).toHaveProperty('updated_at');
        });
    });

    describe('删除会话', () => {
        test('应该成功删除会话', () => {
            const token = generateTestToken();
            testTokens.push(token);
            
            repo.createTemp(token, {}, 'exec');
            repo.delete(token);
            
            const session = repo.get(token);
            expect(session).toBeNull();
        });

        test('删除不存在的会话不应报错', () => {
            const nonExistentToken = generateTestToken();
            
            expect(() => repo.delete(nonExistentToken)).not.toThrow();
        });

        test('删除已删除的会话应保持幂等性', () => {
            const token = generateTestToken();
            testTokens.push(token);
            
            repo.createTemp(token, {}, 'exec');
            repo.delete(token);
            repo.delete(token); // 第二次删除
            
            const session = repo.get(token);
            expect(session).toBeNull();
        });
    });

    describe('边界情况', () => {
        test('应该处理空 cookies 对象', () => {
            const token = generateTestToken();
            testTokens.push(token);
            
            repo.createTemp(token, {}, 'exec');
            
            const session = repo.get(token);
            expect(session).not.toBeNull();
        });

        test('应该处理空 execution', () => {
            const token = generateTestToken();
            testTokens.push(token);
            
            repo.createTemp(token, {}, '');
            
            const session = repo.get(token);
            expect(session?.execution).toBe('');
        });

        test('应该处理空 portal_token', () => {
            const token = generateTestToken();
            testTokens.push(token);
            
            repo.createTemp(token, {}, 'exec');
            repo.bindUser(token, 'test_student', {}, '');
            
            const session = repo.get(token);
            expect(session?.portal_token).toBe('');
        });
    });
});
