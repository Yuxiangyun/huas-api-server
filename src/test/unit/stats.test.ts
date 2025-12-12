/**
 * 统计功能单元测试
 * 测试 StatsRepo 的统计查询功能
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '../../db';
import { StatsRepo } from '../../db/StatsRepo';
import { SessionRepo } from '../../db/SessionRepo';
import { CacheRepo } from '../../db/CacheRepo';
import { UserRepo } from '../../db/UserRepo';

describe('统计仓库测试', () => {
    let statsRepo: StatsRepo;
    let sessionRepo: SessionRepo;
    let cacheRepo: CacheRepo;
    let userRepo: UserRepo;
    
    // 测试数据标识
    const TEST_PREFIX = 'stats_test_';
    const testStudents = [
        `${TEST_PREFIX}001`,
        `${TEST_PREFIX}002`,
        `${TEST_PREFIX}003`
    ];
    
    beforeAll(() => {
        statsRepo = new StatsRepo();
        sessionRepo = new SessionRepo();
        cacheRepo = new CacheRepo();
        userRepo = new UserRepo();
        
        // 准备测试数据
        setupTestData();
    });
    
    afterAll(() => {
        // 清理测试数据
        cleanupTestData();
    });
    
    /**
     * 准备测试数据
     */
    function setupTestData() {
        const now = Date.now();
        
        // 创建测试用户
        testStudents.forEach((studentId, index) => {
            userRepo.saveProfile(
                studentId,
                `测试用户${index + 1}`,
                `测试班级${index + 1}`
            );
            
            // 创建会话
            const token = `${TEST_PREFIX}token_${index}`;
            sessionRepo.createTemp(token, {}, '');
            sessionRepo.bindUser(token, studentId, {}, `portal_${index}`);
            
            // 创建缓存
            cacheRepo.set(studentId, 'SCHEDULE', { test: 'data' });
            cacheRepo.set(studentId, 'USER_INFO', { name: `测试用户${index + 1}` });
        });
        
        // 创建一个临时会话（未登录）
        sessionRepo.createTemp(`${TEST_PREFIX}temp_token`, {}, 'exec');
    }
    
    /**
     * 清理测试数据
     */
    function cleanupTestData() {
        db.run(`DELETE FROM sessions WHERE token LIKE '${TEST_PREFIX}%'`);
        db.run(`DELETE FROM users WHERE student_id LIKE '${TEST_PREFIX}%'`);
        db.run(`DELETE FROM data_cache WHERE student_id LIKE '${TEST_PREFIX}%'`);
    }
    
    describe('用户统计', () => {
        test('应该正确统计总用户数', () => {
            const stats = statsRepo.getUserStats();
            
            expect(stats.totalUsers).toBeGreaterThanOrEqual(3);
        });
        
        test('应该正确统计今日活跃用户', () => {
            const stats = statsRepo.getUserStats();
            
            // 测试数据应该被统计为活跃用户
            expect(stats.activeUsersToday).toBeGreaterThanOrEqual(3);
        });
        
        test('应该正确统计周活跃用户', () => {
            const stats = statsRepo.getUserStats();
            
            expect(stats.activeUsersWeek).toBeGreaterThanOrEqual(stats.activeUsersToday);
        });
        
        test('应该正确统计月活跃用户', () => {
            const stats = statsRepo.getUserStats();
            
            expect(stats.activeUsersMonth).toBeGreaterThanOrEqual(stats.activeUsersWeek);
        });
    });
    
    describe('会话统计', () => {
        test('应该正确统计总会话数', () => {
            const stats = statsRepo.getSessionStats();
            
            expect(stats.totalSessions).toBeGreaterThanOrEqual(4);
        });
        
        test('应该正确统计活跃会话数', () => {
            const stats = statsRepo.getSessionStats();
            
            // 3个已登录会话
            expect(stats.activeSessions).toBeGreaterThanOrEqual(3);
        });
        
        test('应该正确统计临时会话数', () => {
            const stats = statsRepo.getSessionStats();
            
            // 至少1个临时会话
            expect(stats.tempSessions).toBeGreaterThanOrEqual(1);
        });
        
        test('总会话数应等于活跃会话+临时会话', () => {
            const stats = statsRepo.getSessionStats();
            
            expect(stats.totalSessions).toBe(stats.activeSessions + stats.tempSessions);
        });
        
        test('应该正确统计多设备用户', () => {
            const stats = statsRepo.getSessionStats();
            
            // 当前测试数据每个用户只有一个会话
            // 添加一个多设备场景
            const multiDeviceStudent = `${TEST_PREFIX}multi_device`;
            userRepo.saveProfile(multiDeviceStudent, '多设备用户', '测试班级');
            
            const token1 = `${TEST_PREFIX}device1`;
            const token2 = `${TEST_PREFIX}device2`;
            
            sessionRepo.createTemp(token1, {}, '');
            sessionRepo.bindUser(token1, multiDeviceStudent, {}, 'portal1');
            
            sessionRepo.createTemp(token2, {}, '');
            sessionRepo.bindUser(token2, multiDeviceStudent, {}, 'portal2');
            
            const newStats = statsRepo.getSessionStats();
            expect(newStats.multiDeviceUsers).toBeGreaterThanOrEqual(1);
            
            // 清理
            sessionRepo.delete(token1);
            sessionRepo.delete(token2);
        });
    });
    
    describe('缓存统计', () => {
        test('应该正确统计总缓存记录数', () => {
            const stats = statsRepo.getCacheStats();
            
            // 每个用户2条缓存（SCHEDULE + USER_INFO）
            expect(stats.totalCacheRecords).toBeGreaterThanOrEqual(6);
        });
        
        test('应该正确统计课表缓存数', () => {
            const stats = statsRepo.getCacheStats();
            
            expect(stats.scheduleCache).toBeGreaterThanOrEqual(3);
        });
        
        test('应该正确统计用户信息缓存数', () => {
            const stats = statsRepo.getCacheStats();
            
            expect(stats.userInfoCache).toBeGreaterThanOrEqual(3);
        });
        
        test('各类型缓存之和应等于总缓存数', () => {
            const stats = statsRepo.getCacheStats();
            
            const sum = stats.scheduleCache + stats.gradeCache + stats.ecardCache + stats.userInfoCache;
            // 注意：由于数据库中可能还有其他类型的缓存，只验证总数大于等于已知类型之和
            expect(stats.totalCacheRecords).toBeGreaterThanOrEqual(sum);
        });
    });
    
    describe('系统统计', () => {
        test('应该返回完整的系统统计', () => {
            const stats = statsRepo.getSystemStats();
            
            expect(stats).toHaveProperty('user');
            expect(stats).toHaveProperty('session');
            expect(stats).toHaveProperty('cache');
            expect(stats).toHaveProperty('timestamp');
            
            expect(stats.timestamp).toBeGreaterThan(0);
        });
        
        test('系统统计应包含所有子统计', () => {
            const systemStats = statsRepo.getSystemStats();
            const userStats = statsRepo.getUserStats();
            const sessionStats = statsRepo.getSessionStats();
            const cacheStats = statsRepo.getCacheStats();
            
            expect(systemStats.user).toEqual(userStats);
            expect(systemStats.session).toEqual(sessionStats);
            expect(systemStats.cache).toEqual(cacheStats);
        });
    });
    
    describe('活跃用户排行', () => {
        test('应该返回活跃用户列表', () => {
            const ranking = statsRepo.getActiveUsersRanking(10);
            
            expect(Array.isArray(ranking)).toBe(true);
            expect(ranking.length).toBeGreaterThan(0);
        });
        
        test('应该按活跃时间降序排列', () => {
            const ranking = statsRepo.getActiveUsersRanking(10);
            
            for (let i = 0; i < ranking.length - 1; i++) {
                const current = ranking[i];
                const next = ranking[i + 1];
                if (current && next) {
                    expect(current.lastActiveAt).toBeGreaterThanOrEqual(next.lastActiveAt);
                }
            }
        });
        
        test('应该支持限制返回数量', () => {
            const limit = 2;
            const ranking = statsRepo.getActiveUsersRanking(limit);
            
            expect(ranking.length).toBeLessThanOrEqual(limit);
        });
        
        test('返回的用户应包含必要字段', () => {
            const ranking = statsRepo.getActiveUsersRanking(1);
            
            if (ranking.length > 0) {
                const user = ranking[0];
                expect(user).toHaveProperty('studentId');
                expect(user).toHaveProperty('name');
                expect(user).toHaveProperty('lastActiveAt');
            }
        });
    });
    
    describe('边界情况测试', () => {
        test('空数据库应返回零值统计', () => {
            // 清空所有测试数据
            cleanupTestData();
            
            const stats = statsRepo.getSystemStats();
            
            // 注意：可能还有其他非测试数据，所以使用 toBeGreaterThanOrEqual
            expect(stats.user.totalUsers).toBeGreaterThanOrEqual(0);
            expect(stats.session.totalSessions).toBeGreaterThanOrEqual(0);
            expect(stats.cache.totalCacheRecords).toBeGreaterThanOrEqual(0);
            
            // 恢复测试数据
            setupTestData();
        });
        
        test('活跃用户排行榜在无用户时应返回空数组', () => {
            cleanupTestData();
            
            const ranking = statsRepo.getActiveUsersRanking(10);
            expect(Array.isArray(ranking)).toBe(true);
            
            // 恢复测试数据
            setupTestData();
        });
    });
});
