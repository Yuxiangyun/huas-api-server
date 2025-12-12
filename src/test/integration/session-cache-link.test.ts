/**
 * 集成测试 - Session 与 Cache 联动
 * 测试会话和缓存之间的协作逻辑
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { SessionRepo } from '../../db/SessionRepo';
import { CacheRepo } from '../../db/CacheRepo';
import { db } from '../../db';
import { generateTestToken } from '../helpers/TestUtils';

describe('Session 与 Cache 联动测试', () => {
    let sessionRepo: SessionRepo;
    let cacheRepo: CacheRepo;
    let testTokens: string[] = [];
    let testStudentIds: string[] = [];

    beforeEach(() => {
        sessionRepo = new SessionRepo();
        cacheRepo = new CacheRepo();
    });

    afterEach(() => {
        // 清理测试数据
        testTokens.forEach(token => {
            db.run("DELETE FROM sessions WHERE token = ?", [token]);
        });
        testStudentIds.forEach(id => {
            db.run("DELETE FROM data_cache WHERE student_id = ?", [id]);
            db.run("DELETE FROM users WHERE student_id = ?", [id]);
        });
        testTokens = [];
        testStudentIds = [];
    });

    describe('会话绑定与缓存写入', () => {
        test('应该为绑定用户的会话创建独立缓存', () => {
            const token = generateTestToken();
            testTokens.push(token);
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            // 创建会话并绑定用户
            sessionRepo.createTemp(token, {}, '');
            sessionRepo.bindUser(token, studentId, {}, 'portal');
            
            // 为该用户写入缓存
            const userData = { name: '张三', className: '计算机2401' };
            cacheRepo.set(studentId, 'USER_INFO', userData);
            
            // 验证缓存
            const cached = cacheRepo.get<typeof userData>(studentId, 'USER_INFO', 0);
            expect(cached?.name).toBe('张三');
        });

        test('不同会话绑定同一用户应共享缓存', () => {
            const token1 = generateTestToken();
            const token2 = generateTestToken();
            testTokens.push(token1, token2);
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            // 两个会话绑定同一用户
            sessionRepo.createTemp(token1, {}, '');
            sessionRepo.createTemp(token2, {}, '');
            sessionRepo.bindUser(token1, studentId, {}, 'portal1');
            sessionRepo.bindUser(token2, studentId, {}, 'portal2');
            
            // 通过第一个会话写入缓存
            const scheduleData = { courses: [{ name: '数学' }] };
            cacheRepo.set(studentId, 'SCHEDULE', scheduleData);
            
            // 通过第二个会话应该能读到
            const cached = cacheRepo.get<typeof scheduleData>(studentId, 'SCHEDULE', 0);
            expect(cached?.courses?.[0]?.name).toBe('数学');
        });

        test('会话删除不应影响用户缓存', () => {
            const token = generateTestToken();
            testTokens.push(token);
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            sessionRepo.createTemp(token, {}, '');
            sessionRepo.bindUser(token, studentId, {}, 'portal');
            
            // 写入缓存
            cacheRepo.set(studentId, 'USER_INFO', { name: '测试' });
            
            // 删除会话
            sessionRepo.delete(token);
            
            // 缓存应该仍然存在
            const cached = cacheRepo.get<any>(studentId, 'USER_INFO', 0);
            expect(cached).not.toBeNull();
        });
    });

    describe('多设备场景', () => {
        test('同一用户多设备登录应共享缓存数据', () => {
            const mobileToken = generateTestToken();
            const desktopToken = generateTestToken();
            testTokens.push(mobileToken, desktopToken);
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            // 移动端登录
            sessionRepo.createTemp(mobileToken, {}, '');
            sessionRepo.bindUser(mobileToken, studentId, {}, 'mobile-portal');
            
            // 桌面端登录
            sessionRepo.createTemp(desktopToken, {}, '');
            sessionRepo.bindUser(desktopToken, studentId, {}, 'desktop-portal');
            
            // 移动端写入缓存
            const ecardData = { balance: 100.50 };
            cacheRepo.set(studentId, 'ECARD', ecardData);
            
            // 桌面端应该能读到相同数据
            const cachedOnDesktop = cacheRepo.get<typeof ecardData>(studentId, 'ECARD', 0);
            expect(cachedOnDesktop?.balance).toBe(100.50);
            
            // 验证两个会话都关联到同一用户
            const mobileSession = sessionRepo.get(mobileToken);
            const desktopSession = sessionRepo.get(desktopToken);
            expect(mobileSession?.student_id).toBe(desktopSession?.student_id);
        });

        test('多设备场景下缓存更新应对所有设备生效', () => {
            const device1 = generateTestToken();
            const device2 = generateTestToken();
            testTokens.push(device1, device2);
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            sessionRepo.createTemp(device1, {}, '');
            sessionRepo.createTemp(device2, {}, '');
            sessionRepo.bindUser(device1, studentId, {}, 'portal1');
            sessionRepo.bindUser(device2, studentId, {}, 'portal2');
            
            // 设备1 写入初始数据
            cacheRepo.set(studentId, 'USER_INFO', { name: '初始名字' });
            
            // 设备2 更新数据
            cacheRepo.set(studentId, 'USER_INFO', { name: '更新后的名字' });
            
            // 设备1 读取应该是更新后的数据
            const cached = cacheRepo.get<any>(studentId, 'USER_INFO', 0);
            expect(cached?.name).toBe('更新后的名字');
        });
    });

    describe('临时会话处理', () => {
        test('未绑定用户的临时会话不应有缓存', () => {
            const token = generateTestToken();
            testTokens.push(token);
            
            sessionRepo.createTemp(token, {}, 'exec');
            
            const session = sessionRepo.get(token);
            expect(session?.student_id).toBeNull();
            
            // 尝试以 null 学号查询缓存应该返回 null
            const cached = cacheRepo.get<any>(null as any, 'SCHEDULE', 0);
            expect(cached).toBeNull();
        });

        test('临时会话绑定用户后应能正常使用缓存', () => {
            const token = generateTestToken();
            testTokens.push(token);
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            // 先创建临时会话
            sessionRepo.createTemp(token, {}, 'exec');
            
            // 绑定用户
            sessionRepo.bindUser(token, studentId, {}, 'portal');
            
            // 写入缓存
            cacheRepo.set(studentId, 'SCHEDULE', { courses: [] });
            
            // 应该能读取
            const cached = cacheRepo.get<any>(studentId, 'SCHEDULE', 0);
            expect(cached).not.toBeNull();
        });
    });

    describe('缓存隔离性', () => {
        test('不同用户的缓存应完全隔离', () => {
            const token1 = generateTestToken();
            const token2 = generateTestToken();
            testTokens.push(token1, token2);
            const student1 = `test_user1_${Date.now()}`;
            const student2 = `test_user2_${Date.now()}`;
            testStudentIds.push(student1, student2);
            
            // 创建两个用户的会话
            sessionRepo.createTemp(token1, {}, '');
            sessionRepo.createTemp(token2, {}, '');
            sessionRepo.bindUser(token1, student1, {}, 'portal1');
            sessionRepo.bindUser(token2, student2, {}, 'portal2');
            
            // 为每个用户写入不同的缓存
            cacheRepo.set(student1, 'USER_INFO', { name: '用户1' });
            cacheRepo.set(student2, 'USER_INFO', { name: '用户2' });
            
            // 验证缓存隔离
            const cached1 = cacheRepo.get<any>(student1, 'USER_INFO', 0);
            const cached2 = cacheRepo.get<any>(student2, 'USER_INFO', 0);
            
            expect(cached1?.name).toBe('用户1');
            expect(cached2?.name).toBe('用户2');
            expect(cached1?.name).not.toBe(cached2?.name);
        });

        test('同一用户不同类型的缓存应独立', () => {
            const token = generateTestToken();
            testTokens.push(token);
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            sessionRepo.createTemp(token, {}, '');
            sessionRepo.bindUser(token, studentId, {}, 'portal');
            
            // 写入多种类型缓存
            cacheRepo.set(studentId, 'SCHEDULE', { type: 'schedule' });
            cacheRepo.set(studentId, 'ECARD', { type: 'ecard' });
            cacheRepo.set(studentId, 'USER_INFO', { type: 'user' });
            
            // 验证每种缓存都独立存在
            const schedule = cacheRepo.get<any>(studentId, 'SCHEDULE', 0);
            const ecard = cacheRepo.get<any>(studentId, 'ECARD', 0);
            const user = cacheRepo.get<any>(studentId, 'USER_INFO', 0);
            
            expect(schedule?.type).toBe('schedule');
            expect(ecard?.type).toBe('ecard');
            expect(user?.type).toBe('user');
        });
    });

    describe('会话与缓存的生命周期', () => {
        test('会话存续期间缓存应持续有效', () => {
            const token = generateTestToken();
            testTokens.push(token);
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            sessionRepo.createTemp(token, {}, '');
            sessionRepo.bindUser(token, studentId, {}, 'portal');
            cacheRepo.set(studentId, 'SCHEDULE', { courses: ['数学'] });
            
            // 多次查询会话和缓存
            for (let i = 0; i < 5; i++) {
                const session = sessionRepo.get(token);
                const cached = cacheRepo.get<any>(studentId, 'SCHEDULE', 0);
                
                expect(session).not.toBeNull();
                expect(cached).not.toBeNull();
            }
        });

        test('会话过期后缓存仍应独立存在', () => {
            const token = generateTestToken();
            testTokens.push(token);
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            sessionRepo.createTemp(token, {}, '');
            sessionRepo.bindUser(token, studentId, {}, 'portal');
            cacheRepo.set(studentId, 'USER_INFO', { name: '测试' });
            
            // 删除会话（模拟过期）
            sessionRepo.delete(token);
            
            // 会话应该不存在
            expect(sessionRepo.get(token)).toBeNull();
            
            // 但缓存应该仍然存在
            const cached = cacheRepo.get<any>(studentId, 'USER_INFO', 0);
            expect(cached).not.toBeNull();
            expect(cached?.name).toBe('测试');
        });
    });
});
