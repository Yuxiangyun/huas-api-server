/**
 * E2E 测试 - 认证流程
 * 测试完整的用户认证链路（不涉及真实网络请求）
 */
import { describe, test, expect, beforeAll } from 'bun:test';
import { generateTestToken } from '../helpers/TestUtils';
import { SessionRepo } from '../../db/SessionRepo';

describe('E2E - 认证流程测试', () => {
    let sessionRepo: SessionRepo;
    
    beforeAll(() => {
        sessionRepo = new SessionRepo();
    });
    
    test('完整的登录流程：验证码 -> 登录 -> 数据访问 -> 登出', async () => {
        // 1. 获取验证码（创建临时会话）
        const sessionId = generateTestToken();
        sessionRepo.createTemp(sessionId, { jsessionid: 'temp_session' }, 'e1s1');
        
        let session = sessionRepo.get(sessionId);
        expect(session).not.toBeNull();
        expect(session?.student_id).toBeNull();
        expect(session?.execution).toBe('e1s1');
        
        // 2. 模拟登录成功（绑定用户）
        const studentId = 'e2e_test_' + Date.now();
        sessionRepo.bindUser(sessionId, studentId, { jsessionid: 'user_session' }, 'portal_token_123');
        
        session = sessionRepo.get(sessionId);
        expect(session?.student_id).toBe(studentId);
        expect(session?.portal_token).toBe('portal_token_123');
        expect(session?.execution).toBeNull();
        
        // 3. 模拟数据访问（验证会话有效）
        const validSession = sessionRepo.get(sessionId);
        expect(validSession).not.toBeNull();
        expect(validSession?.student_id).toBe(studentId);
        
        // 4. 退出登录
        sessionRepo.delete(sessionId);
        
        const deletedSession = sessionRepo.get(sessionId);
        expect(deletedSession).toBeNull();
    });
    
    test('会话隔离：不同用户的会话应该独立', () => {
        const user1Token = generateTestToken();
        const user2Token = generateTestToken();
        
        sessionRepo.createTemp(user1Token, {}, 'e1');
        sessionRepo.createTemp(user2Token, {}, 'e2');
        
        sessionRepo.bindUser(user1Token, 'user1_' + Date.now(), {}, 'token1');
        sessionRepo.bindUser(user2Token, 'user2_' + Date.now(), {}, 'token2');
        
        const session1 = sessionRepo.get(user1Token);
        const session2 = sessionRepo.get(user2Token);
        
        expect(session1?.student_id).not.toBe(session2?.student_id);
        expect(session1?.portal_token).toBe('token1');
        expect(session2?.portal_token).toBe('token2');
    });
    
    test('会话过期场景：删除后无法访问', () => {
        const token = generateTestToken();
        sessionRepo.createTemp(token, {}, 'exec');
        sessionRepo.bindUser(token, 'expired_user', {}, 'token');
        
        // 模拟会话过期
        sessionRepo.delete(token);
        
        // 尝试访问应该失败
        const session = sessionRepo.get(token);
        expect(session).toBeNull();
    });
});
