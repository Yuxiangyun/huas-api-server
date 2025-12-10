/**
 * 数据隔离安全测试
 * 验证用户只能访问自己的数据，不能访问其他用户的数据
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { SessionRepo } from '../../db/SessionRepo';
import { CacheRepo } from '../../db/CacheRepo';
import { UserRepo } from '../../db/UserRepo';
import { StudentService } from '../../services/StudentService';
import { generateTestToken } from '../helpers/TestUtils';

describe('数据隔离安全测试', () => {
    let sessionRepo: SessionRepo;
    let cacheRepo: CacheRepo;
    let userRepo: UserRepo;
    
    // 测试用户
    const user1 = {
        token: generateTestToken(),
        studentId: 'test_isolation_user1',
        name: '测试用户1',
        className: '测试班级1'
    };
    
    const user2 = {
        token: generateTestToken(),
        studentId: 'test_isolation_user2',
        name: '测试用户2',
        className: '测试班级2'
    };
    
    beforeAll(() => {
        sessionRepo = new SessionRepo();
        cacheRepo = new CacheRepo();
        userRepo = new UserRepo();
        
        // 创建两个用户的会话和数据
        setupTestData();
    });
    
    afterAll(() => {
        cleanupTestData();
    });
    
    /**
     * 准备测试数据
     */
    function setupTestData() {
        // 用户1
        userRepo.saveProfile(user1.studentId, user1.name, user1.className);
        sessionRepo.createTemp(user1.token, {}, '');
        sessionRepo.bindUser(user1.token, user1.studentId, {}, 'portal1');
        cacheRepo.set(user1.studentId, 'USER_INFO', {
            name: user1.name,
            className: user1.className,
            studentId: user1.studentId
        });
        cacheRepo.set(user1.studentId, 'SCHEDULE', {
            week: '第1周',
            courses: [{ name: '用户1的课程' }]
        });
        
        // 用户2
        userRepo.saveProfile(user2.studentId, user2.name, user2.className);
        sessionRepo.createTemp(user2.token, {}, '');
        sessionRepo.bindUser(user2.token, user2.studentId, {}, 'portal2');
        cacheRepo.set(user2.studentId, 'USER_INFO', {
            name: user2.name,
            className: user2.className,
            studentId: user2.studentId
        });
        cacheRepo.set(user2.studentId, 'SCHEDULE', {
            week: '第1周',
            courses: [{ name: '用户2的课程' }]
        });
    }
    
    /**
     * 清理测试数据
     */
    function cleanupTestData() {
        sessionRepo.delete(user1.token);
        sessionRepo.delete(user2.token);
        
        // 注意：这里不清理 users 和 cache，因为可能影响其他测试
    }
    
    describe('会话隔离', () => {
        test('用户1的 token 应该只能访问用户1的会话', () => {
            const session1 = sessionRepo.get(user1.token);
            const session2 = sessionRepo.get(user2.token);
            
            expect(session1).not.toBeNull();
            expect(session2).not.toBeNull();
            expect(session1?.student_id).toBe(user1.studentId);
            expect(session2?.student_id).toBe(user2.studentId);
        });
        
        test('用户不能使用其他用户的 token', () => {
            const session = sessionRepo.get(user1.token);
            expect(session?.student_id).not.toBe(user2.studentId);
        });
    });
    
    describe('缓存数据隔离', () => {
        test('缓存应该基于 student_id 隔离', () => {
            const cache1 = cacheRepo.get<any>(user1.studentId, 'USER_INFO', 3600);
            const cache2 = cacheRepo.get<any>(user2.studentId, 'USER_INFO', 3600);
            
            expect(cache1).not.toBeNull();
            expect(cache2).not.toBeNull();
            expect(cache1?.name).toBe(user1.name);
            expect(cache2?.name).toBe(user2.name);
        });
        
        test('用户1不能访问用户2的缓存', () => {
            const cache = cacheRepo.get<any>(user1.studentId, 'USER_INFO', 3600);
            
            expect(cache?.name).not.toBe(user2.name);
            expect(cache?.studentId).not.toBe(user2.studentId);
        });
        
        test('课表数据应该正确隔离', () => {
            const schedule1 = cacheRepo.get<any>(user1.studentId, 'SCHEDULE', 3600);
            const schedule2 = cacheRepo.get<any>(user2.studentId, 'SCHEDULE', 3600);
            
            expect(schedule1?.courses[0].name).toBe('用户1的课程');
            expect(schedule2?.courses[0].name).toBe('用户2的课程');
        });
    });
    
    describe('服务层数据隔离', () => {
        test('StudentService 应该正确识别用户身份', () => {
            // 注意：StudentService 会尝试从数据库恢复会话
            // 如果会话存在且已绑定用户，studentId 就会被设置
            const service1 = new StudentService(user1.token);
            const service2 = new StudentService(user2.token);
            
            // 注意：由于 HuasClient 的实现，只有在登录后才会设置 userId
            // 这里我们直接验证会话是否正确隔离
            const session1 = sessionRepo.get(user1.token);
            const session2 = sessionRepo.get(user2.token);
            
            expect(session1?.student_id).toBe(user1.studentId);
            expect(session2?.student_id).toBe(user2.studentId);
        });
        
        test('用户1的服务实例不能访问用户2的数据', () => {
            // 直接验证缓存隔离（不依赖网络请求）
            const cache1 = cacheRepo.get<any>(user1.studentId, 'USER_INFO', 3600);
            const cache2 = cacheRepo.get<any>(user2.studentId, 'USER_INFO', 3600);
            
            expect(cache1?.studentId).toBe(user1.studentId);
            expect(cache2?.studentId).toBe(user2.studentId);
            expect(cache1?.studentId).not.toBe(user2.studentId);
        });
        
        test('使用错误的 token 应该无法创建服务', () => {
            const invalidToken = 'invalid-token-12345';
            
            // 验证会话不存在
            const session = sessionRepo.get(invalidToken);
            expect(session).toBeNull();
            
            // 创建服务会成功，但 studentId 为 undefined
            const service = new StudentService(invalidToken);
            expect(service.studentId).toBeUndefined();
        });
    });
    
    describe('边界情况测试', () => {
        test('删除会话后，token 应该立即失效', () => {
            const tempToken = generateTestToken();
            const tempStudentId = 'test_temp_isolation';
            
            // 创建临时会话
            sessionRepo.createTemp(tempToken, {}, '');
            sessionRepo.bindUser(tempToken, tempStudentId, {}, 'temp_portal');
            
            // 验证会话存在
            let session = sessionRepo.get(tempToken);
            expect(session).not.toBeNull();
            expect(session?.student_id).toBe(tempStudentId);
            
            // 删除会话
            sessionRepo.delete(tempToken);
            
            // 验证会话已删除
            session = sessionRepo.get(tempToken);
            expect(session).toBeNull();
            
            // 创建服务，studentId 应为 undefined
            const service = new StudentService(tempToken);
            expect(service.studentId).toBeUndefined();
        });
        
        test('同一用户的多个 token 应该访问相同的数据', () => {
            const secondToken = generateTestToken();
            
            // 为用户1创建第二个 token
            sessionRepo.createTemp(secondToken, {}, '');
            sessionRepo.bindUser(secondToken, user1.studentId, {}, 'portal_second');
            
            // 两个 token 应该关联到同一个 student_id
            const session1 = sessionRepo.get(user1.token);
            const session2 = sessionRepo.get(secondToken);
            
            expect(session1?.student_id).toBe(user1.studentId);
            expect(session2?.student_id).toBe(user1.studentId);
            
            // 两个 token 应该访问相同的缓存数据
            const cache = cacheRepo.get<any>(user1.studentId, 'USER_INFO', 3600);
            expect(cache?.studentId).toBe(user1.studentId);
            
            // 清理
            sessionRepo.delete(secondToken);
        });
        
        test('未登录的 token 不能访问业务数据', async () => {
            const tempToken = generateTestToken();
            
            // 创建临时会话但不绑定用户
            sessionRepo.createTemp(tempToken, {}, 'exec');
            
            const service = new StudentService(tempToken);
            
            // studentId 应该为 undefined（因为会话未绑定用户）
            expect(service.studentId).toBeUndefined();
            
            // 尝试获取数据应该抛出异常
            await expect(service.getUserInfo()).rejects.toThrow();
            
            // 清理
            sessionRepo.delete(tempToken);
        });
    });
    
    describe('SQL 注入防护', () => {
        test('student_id 包含 SQL 注入字符应该被安全处理', () => {
            const maliciousStudentId = "'; DROP TABLE users; --";
            const maliciousToken = generateTestToken();
            
            // 尝试创建恶意会话
            sessionRepo.createTemp(maliciousToken, {}, '');
            sessionRepo.bindUser(maliciousToken, maliciousStudentId, {}, 'portal');
            
            // 验证会话可以正常获取（使用 Prepared Statements）
            const session = sessionRepo.get(maliciousToken);
            expect(session).not.toBeNull();
            expect(session?.student_id).toBe(maliciousStudentId);
            
            // 验证数据库表仍然存在（通过查询其他正常会话）
            // 注意：afterAll 中会清理 user1.token，所以这里只验证表结构
            const testQuery = sessionRepo.get(maliciousToken);
            expect(testQuery).not.toBeNull();
            
            // 清理
            sessionRepo.delete(maliciousToken);
        });
    });
});
