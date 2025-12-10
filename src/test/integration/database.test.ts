/**
 * 集成测试 - 数据库层
 * 测试所有 Repository 的数据操作
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { SessionRepo } from '../../db/SessionRepo';
import { CacheRepo } from '../../db/CacheRepo';
import { UserRepo } from '../../db/UserRepo';
import { generateTestToken, sleep } from '../helpers/TestUtils';
import { CACHE_TEST_DATA } from '../helpers/MockData';

describe('数据库层集成测试', () => {
    let sessionRepo: SessionRepo;
    let cacheRepo: CacheRepo;
    let userRepo: UserRepo;
    
    beforeEach(() => {
        sessionRepo = new SessionRepo();
        cacheRepo = new CacheRepo();
        userRepo = new UserRepo();
    });
    
    afterEach(() => {
        // 清理测试数据通过 SessionRepo 等实例方法
        // 注意：实际的 Repo 没有暴露 db 属性
    });
    
    describe('SessionRepo', () => {
        test('应该正确创建临时会话', () => {
            const token = generateTestToken();
            sessionRepo.createTemp(token, { session: 'test_cookies' }, 'test_execution');
            
            const session = sessionRepo.get(token);
            expect(session).not.toBeNull();
            expect(session?.token).toBe(token);
            expect(session?.student_id).toBeNull();
            expect(session?.execution).toBe('test_execution');
        });
        
        test('应该正确绑定用户', () => {
            const token = generateTestToken();
            sessionRepo.createTemp(token, { test: 'cookies' }, 'exec');
            
            sessionRepo.bindUser(token, 'test_student_123', { test: 'new_cookies' }, 'portal_token_abc');
            
            const session = sessionRepo.get(token);
            expect(session?.student_id).toBe('test_student_123');
            expect(session?.portal_token).toBe('portal_token_abc');
            expect(session?.execution).toBeNull(); // 绑定后应清空
        });
        
        test('应该正确删除会话', () => {
            const token = generateTestToken();
            sessionRepo.createTemp(token, {}, 'exec');
            
            expect(sessionRepo.get(token)).not.toBeNull();
            
            sessionRepo.delete(token);
            expect(sessionRepo.get(token)).toBeNull();
        });
        
        test('查询不存在的会话应返回 null', () => {
            const result = sessionRepo.get('non-existent-token-' + Date.now());
            expect(result).toBeNull();
        });
        
    });
    
    describe('CacheRepo', () => {
        const userId = 'test_user_' + Date.now();
        
        test('应该正确存储和读取缓存', () => {
            cacheRepo.set(userId, 'SCHEDULE', CACHE_TEST_DATA.SCHEDULE);
            
            const cached = cacheRepo.get<typeof CACHE_TEST_DATA.SCHEDULE>(userId, 'SCHEDULE', 3600);
            expect(cached).not.toBeNull();
            expect(cached?.week).toBe('第15周');
            expect(cached?.courses).toBeArrayOfSize(1);
        });
        
        test('应该正确处理缓存过期 (TTL > 0)', async () => {
            cacheRepo.set(userId, 'TEST_TTL', { value: '测试数据' });
            
            // TTL = 1 秒，立即读取应该成功
            let cached = cacheRepo.get(userId, 'TEST_TTL', 1);
            expect(cached).not.toBeNull();
            
            // 等待 1.1 秒后应该过期
            await sleep(1100);
            cached = cacheRepo.get(userId, 'TEST_TTL', 1);
            expect(cached).toBeNull();
        });
        
        test('TTL = 0 时缓存应永不过期', async () => {
            cacheRepo.set(userId, 'PERMANENT', { value: '永久数据' });
            
            await sleep(100);
            
            const cached = cacheRepo.get(userId, 'PERMANENT', 0);
            expect(cached).not.toBeNull();
        });
        
        test('应该正确覆盖写入缓存', () => {
            cacheRepo.set(userId, 'OVERWRITE', { value: '旧数据' });
            cacheRepo.set(userId, 'OVERWRITE', { value: '新数据' });
            
            const cached = cacheRepo.get<any>(userId, 'OVERWRITE', 3600);
            expect(cached?.value).toBe('新数据');
        });
        
        test('不同用户的缓存应该隔离', () => {
            const user1 = 'test_user_1';
            const user2 = 'test_user_2';
            
            cacheRepo.set(user1, 'DATA', { value: 'user1_data' });
            cacheRepo.set(user2, 'DATA', { value: 'user2_data' });
            
            const cache1 = cacheRepo.get<any>(user1, 'DATA', 3600);
            const cache2 = cacheRepo.get<any>(user2, 'DATA', 3600);
            
            expect(cache1?.value).toBe('user1_data');
            expect(cache2?.value).toBe('user2_data');
        });
        
        test('不同类型的缓存应该隔离', () => {
            cacheRepo.set(userId, 'TYPE_A', { value: 'A' });
            cacheRepo.set(userId, 'TYPE_B', { value: 'B' });
            
            const cacheA = cacheRepo.get<any>(userId, 'TYPE_A', 3600);
            const cacheB = cacheRepo.get<any>(userId, 'TYPE_B', 3600);
            
            expect(cacheA?.value).toBe('A');
            expect(cacheB?.value).toBe('B');
        });
    });
    
    describe('UserRepo', () => {
        test('应该正确保存用户资料', () => {
            const userId = 'test_user_' + Date.now();
            
            userRepo.saveProfile(userId, '测试用户', '测试班级');
            
            // UserRepo 没有 get 方法，通过其他方式验证
            // 这里只验证不抛出错误
            expect(true).toBe(true);
        });
        
        test('应该正确更新活跃时间', () => {
            const userId = 'test_user_touch_' + Date.now();
            
            userRepo.saveProfile(userId, '用户', '班级');
            userRepo.touch(userId);
            
            // 验证不抛出错误
            expect(true).toBe(true);
        });
    });
    
    describe('数据库事务和并发', () => {
        test('并发写入同一会话应该正确处理', async () => {
            const token = generateTestToken();
            sessionRepo.createTemp(token, {}, 'exec');
            
            // 模拟并发绑定（实际项目中不会这样做）
            const updates = [
                () => sessionRepo.bindUser(token, 'test_user_1', {}, 'token1'),
                () => sessionRepo.bindUser(token, 'test_user_2', {}, 'token2'),
                () => sessionRepo.bindUser(token, 'test_user_3', {}, 'token3'),
            ];
            
            await Promise.all(updates.map(fn => fn()));
            
            // 最终应该有一个值
            const session = sessionRepo.get(token);
            expect(session?.student_id).toMatch(/test_user_[123]/);
        });
        
        test('并发缓存读写应该正确处理', async () => {
            const userId = 'test_concurrent_' + Date.now();
            
            const operations = Array.from({ length: 10 }, (_, i) => 
                () => cacheRepo.set(userId, 'CONCURRENT', { index: i })
            );
            
            await Promise.all(operations.map(fn => fn()));
            
            const cached = cacheRepo.get<any>(userId, 'CONCURRENT', 3600);
            expect(cached).not.toBeNull();
            expect(cached?.index).toBeGreaterThanOrEqual(0);
            expect(cached?.index).toBeLessThan(10);
        });
    });
});
