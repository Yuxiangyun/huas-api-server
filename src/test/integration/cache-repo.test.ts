/**
 * 集成测试 - CacheRepo
 * 测试数据缓存仓储的所有功能点
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { CacheRepo } from '../../db/CacheRepo';
import { db } from '../../db';

describe('CacheRepo 集成测试', () => {
    let repo: CacheRepo;
    let testStudentIds: string[] = [];

    beforeEach(() => {
        repo = new CacheRepo();
    });

    afterEach(() => {
        // 清理测试数据
        testStudentIds.forEach(id => {
            db.run("DELETE FROM data_cache WHERE student_id = ?", [id]);
        });
        testStudentIds = [];
    });

    describe('写入缓存', () => {
        test('应该成功写入缓存', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            const data = { name: '张三', class: '计算机2024-1' };
            
            repo.set(studentId, 'USER_INFO', data);
            
            const cached = repo.get<typeof data>(studentId, 'USER_INFO', 0);
            expect(cached).not.toBeNull();
            expect(cached?.name).toBe('张三');
        });

        test('应该正确序列化复杂对象', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            const complexData = {
                courses: [
                    { name: '高等数学', teacher: '张教授', day: 1, section: '1-2' },
                    { name: '英语', teacher: '李老师', day: 2, section: '3-4' }
                ],
                totalCredits: 5.0,
                semester: '2024-2025-1'
            };
            
            repo.set(studentId, 'SCHEDULE', complexData);
            
            const cached = repo.get<typeof complexData>(studentId, 'SCHEDULE', 0);
            expect(cached?.courses).toHaveLength(2);
            expect(cached?.courses?.[0]?.name).toBe('高等数学');
            expect(cached?.totalCredits).toBe(5.0);
        });

        test('应该覆盖写入已存在的缓存', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            repo.set(studentId, 'USER_INFO', { name: '旧名字' });
            repo.set(studentId, 'USER_INFO', { name: '新名字' });
            
            const cached = repo.get<any>(studentId, 'USER_INFO', 0);
            expect(cached?.name).toBe('新名字');
        });

        test('应该更新 updated_at 时间戳', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            const beforeTime = Date.now();
            
            repo.set(studentId, 'USER_INFO', { test: 'data' });
            
            const result = db.prepare(
                "SELECT updated_at FROM data_cache WHERE student_id = ? AND type = ?"
            ).get(studentId, 'USER_INFO') as any;
            
            expect(result.updated_at).toBeGreaterThanOrEqual(beforeTime);
        });
    });

    describe('读取缓存', () => {
        test('应该成功读取缓存', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            const data = { balance: 100.50 };
            
            repo.set(studentId, 'ECARD', data);
            const cached = repo.get<typeof data>(studentId, 'ECARD', 0);
            
            expect(cached).not.toBeNull();
            expect(cached?.balance).toBe(100.50);
        });

        test('读取不存在的缓存应返回 null', () => {
            const nonExistentId = `test_nonexistent_${Date.now()}`;
            
            const cached = repo.get<any>(nonExistentId, 'SCHEDULE', 0);
            expect(cached).toBeNull();
        });

        test('TTL=0 时应忽略过期检查', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            repo.set(studentId, 'USER_INFO', { name: 'test' });
            
            // 手动设置为很久以前
            db.run(
                "UPDATE data_cache SET updated_at = ? WHERE student_id = ? AND type = ?",
                [Date.now() - 365 * 24 * 60 * 60 * 1000, studentId, 'USER_INFO']
            );
            
            const cached = repo.get<any>(studentId, 'USER_INFO', 0);
            expect(cached).not.toBeNull();
        });

        test('应该正确反序列化 JSON', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            const data = {
                array: [1, 2, 3],
                object: { nested: true },
                number: 42,
                string: 'test',
                boolean: true,
                null: null
            };
            
            repo.set(studentId, 'TEST_DATA', data);
            const cached = repo.get<typeof data>(studentId, 'TEST_DATA', 0);
            
            expect(cached?.array).toEqual([1, 2, 3]);
            expect(cached?.object.nested).toBe(true);
            expect(cached?.number).toBe(42);
            expect(cached?.boolean).toBe(true);
            expect(cached?.null).toBeNull();
        });
    });

    describe('缓存过期', () => {
        test('过期缓存应返回 null', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            repo.set(studentId, 'SCHEDULE', { courses: [] });
            
            // 设置为 2 秒前
            db.run(
                "UPDATE data_cache SET updated_at = ? WHERE student_id = ? AND type = ?",
                [Date.now() - 2000, studentId, 'SCHEDULE']
            );
            
            // TTL = 1 秒，应该过期
            const cached = repo.get<any>(studentId, 'SCHEDULE', 1);
            expect(cached).toBeNull();
        });

        test('未过期缓存应返回数据', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            repo.set(studentId, 'SCHEDULE', { courses: ['数学'] });
            
            // TTL = 3600 秒（1小时），应该未过期
            const cached = repo.get<any>(studentId, 'SCHEDULE', 3600);
            expect(cached).not.toBeNull();
            expect(cached?.courses[0]).toBe('数学');
        });

        test('边界情况：刚好在过期边界', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            repo.set(studentId, 'ECARD', { balance: 50 });
            
            // 设置为刚好 10 秒前
            const tenSecondsAgo = Date.now() - 10 * 1000;
            db.run(
                "UPDATE data_cache SET updated_at = ? WHERE student_id = ? AND type = ?",
                [tenSecondsAgo, studentId, 'ECARD']
            );
            
            // TTL = 9 秒，应该过期（因为数据是 10 秒前的）
            const expired = repo.get<any>(studentId, 'ECARD', 9);
            // TTL = 11 秒，未过期
            const notExpired = repo.get<any>(studentId, 'ECARD', 11);
            
            expect(expired).toBeNull();
            expect(notExpired).not.toBeNull();
        });
    });

    describe('数据类型测试', () => {
        test('应该正确处理不同缓存类型', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            repo.set(studentId, 'SCHEDULE', { type: 'schedule' });
            repo.set(studentId, 'ECARD', { type: 'ecard' });
            repo.set(studentId, 'USER_INFO', { type: 'user' });
            
            const schedule = repo.get<any>(studentId, 'SCHEDULE', 0);
            const ecard = repo.get<any>(studentId, 'ECARD', 0);
            const user = repo.get<any>(studentId, 'USER_INFO', 0);
            
            expect(schedule?.type).toBe('schedule');
            expect(ecard?.type).toBe('ecard');
            expect(user?.type).toBe('user');
        });

        test('同一学号的不同类型缓存应独立', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            repo.set(studentId, 'SCHEDULE', { value: 'A' });
            repo.set(studentId, 'ECARD', { value: 'B' });
            
            const schedule = repo.get<any>(studentId, 'SCHEDULE', 0);
            const ecard = repo.get<any>(studentId, 'ECARD', 0);
            
            expect(schedule?.value).toBe('A');
            expect(ecard?.value).toBe('B');
        });
    });

    describe('特殊字符和边界数据', () => {
        test('应该正确处理包含特殊字符的数据', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            const specialData = {
                note: '包含"引号"和\'单引号\'以及\\反斜杠',
                unicode: '中文测试🎓👨‍🎓',
                newline: '第一行\n第二行',
                tab: '列1\t列2'
            };
            
            repo.set(studentId, 'SPECIAL', specialData);
            const cached = repo.get<typeof specialData>(studentId, 'SPECIAL', 0);
            
            expect(cached?.note).toContain('"引号"');
            expect(cached?.unicode).toContain('🎓');
            expect(cached?.newline).toContain('\n');
            expect(cached?.tab).toContain('\t');
        });

        test('应该处理空对象', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            repo.set(studentId, 'EMPTY', {});
            const cached = repo.get<any>(studentId, 'EMPTY', 0);
            
            expect(cached).toEqual({});
        });

        test('应该处理数组数据', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            const arrayData = [1, 2, 3, 4, 5];
            
            repo.set(studentId, 'ARRAY', arrayData);
            const cached = repo.get<typeof arrayData>(studentId, 'ARRAY', 0);
            
            expect(cached).toEqual([1, 2, 3, 4, 5]);
        });
    });
});
