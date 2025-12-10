/**
 * 性能测试 - 缓存效率
 * 测试缓存命中率、过期机制、并发性能
 */
import { describe, test, expect, beforeEach } from 'bun:test';
import { CacheRepo } from '../../db/CacheRepo';
import { sleep, measureTime, concurrent } from '../helpers/TestUtils';
import { CACHE_TEST_DATA, CONCURRENT_TEST_CONFIG } from '../helpers/MockData';

describe('性能测试 - 缓存机制', () => {
    let cacheRepo: CacheRepo;
    
    beforeEach(() => {
        cacheRepo = new CacheRepo();
    });
    
    describe('缓存命中性能', () => {
        test('缓存命中应该远快于网络请求', async () => {
            const userId = 'perf_test_' + Date.now();
            const data = CACHE_TEST_DATA.SCHEDULE;
            
            // 第一次写入
            cacheRepo.set(userId, 'SCHEDULE', data);
            
            // 测量缓存读取时间
            const { duration: cacheTime } = await measureTime(async () => {
                for (let i = 0; i < 100; i++) {
                    cacheRepo.get(userId, 'SCHEDULE', 3600);
                }
            });
            
            console.log(`✓ 100次缓存读取耗时: ${cacheTime}ms (平均: ${cacheTime/100}ms)`);
            
            // 缓存读取应该非常快（< 50ms for 100 reads）
            expect(cacheTime).toBeLessThan(50);
        });
        
        test('大量数据缓存读写性能', async () => {
            const userId = 'perf_large_' + Date.now();
            const largeData = {
                courses: Array.from({ length: 100 }, (_, i) => ({
                    day: i % 7 + 1,
                    section: `第${i}节`,
                    name: `课程${i}`,
                    location: `教室${i}`,
                    teacher: `教师${i}`,
                    weekStr: '1-16周'
                }))
            };
            
            // 写入性能
            const { duration: writeTime } = await measureTime(async () => {
                cacheRepo.set(userId, 'LARGE_SCHEDULE', largeData);
            });
            
            // 读取性能
            const { duration: readTime } = await measureTime(async () => {
                cacheRepo.get(userId, 'LARGE_SCHEDULE', 3600);
            });
            
            console.log(`✓ 大数据写入: ${writeTime}ms, 读取: ${readTime}ms`);
            
            expect(writeTime).toBeLessThan(100);
            expect(readTime).toBeLessThan(50);
        });
    });
    
    describe('缓存过期时效性', () => {
        test('TTL=1秒的缓存应该准时过期', async () => {
            const userId = 'ttl_test_' + Date.now();
            cacheRepo.set(userId, 'SHORT_TTL', { value: '短期数据' });
            
            // 立即读取应该成功
            let cached = cacheRepo.get(userId, 'SHORT_TTL', 1);
            expect(cached).not.toBeNull();
            
            // 等待 1.1 秒
            await sleep(1100);
            
            // 再次读取应该失败
            cached = cacheRepo.get(userId, 'SHORT_TTL', 1);
            expect(cached).toBeNull();
            
            console.log('✓ 缓存准时过期');
        });
        
        test('TTL=0 应该永不过期', async () => {
            const userId = 'permanent_' + Date.now();
            cacheRepo.set(userId, 'PERMANENT', { value: '永久数据' });
            
            await sleep(200);
            
            const cached = cacheRepo.get(userId, 'PERMANENT', 0);
            expect(cached).not.toBeNull();
            
            console.log('✓ TTL=0 缓存永不过期');
        });
    });
    
    describe('并发缓存操作', () => {
        test('低负载并发读写（10 并发）', async () => {
            const userId = 'concurrent_low';
            
            const { duration } = await measureTime(async () => {
                const tasks = Array.from({ length: CONCURRENT_TEST_CONFIG.LOW_LOAD }, (_, i) => 
                    async () => cacheRepo.set(userId + i, 'DATA', { index: i })
                );
                
                await concurrent(tasks, 10);
            });
            
            console.log(`✓ 10 并发写入耗时: ${duration}ms`);
            expect(duration).toBeLessThan(1000);
        });
        
        test('中等负载并发读写（50 并发）', async () => {
            const userId = 'concurrent_medium';
            
            // 先写入数据
            for (let i = 0; i < 50; i++) {
                cacheRepo.set(userId + i, 'DATA', { index: i });
            }
            
            const { duration } = await measureTime(async () => {
                const tasks = Array.from({ length: CONCURRENT_TEST_CONFIG.MEDIUM_LOAD }, (_, i) => 
                    async () => cacheRepo.get(userId + (i % 50), 'DATA', 3600)
                );
                
                await concurrent(tasks, 20);
            });
            
            console.log(`✓ 50 并发读取耗时: ${duration}ms`);
            expect(duration).toBeLessThan(2000);
        });
        
        test('高负载混合读写（100 并发）', async () => {
            const userId = 'concurrent_high';
            
            const { duration } = await measureTime(async () => {
                const tasks = Array.from({ length: CONCURRENT_TEST_CONFIG.HIGH_LOAD }, (_, i) => {
                    if (i % 2 === 0) {
                        return async () => cacheRepo.set(userId + i, 'DATA', { index: i });
                    } else {
                        return async () => cacheRepo.get(userId + (i - 1), 'DATA', 3600);
                    }
                });
                
                await concurrent(tasks, 30);
            });
            
            console.log(`✓ 100 并发混合读写耗时: ${duration}ms`);
            expect(duration).toBeLessThan(3000);
        });
    });
    
    describe('缓存隔离性', () => {
        test('不同用户缓存应该完全隔离', () => {
            const users = Array.from({ length: 10 }, (_, i) => `user_${i}`);
            
            // 每个用户写入不同数据
            users.forEach((userId, index) => {
                cacheRepo.set(userId, 'DATA', { userId, index });
            });
            
            // 验证每个用户读取自己的数据
            users.forEach((userId, index) => {
                const cached = cacheRepo.get<any>(userId, 'DATA', 3600);
                expect(cached?.userId).toBe(userId);
                expect(cached?.index).toBe(index);
            });
            
            console.log('✓ 10个用户缓存完全隔离');
        });
    });
});
