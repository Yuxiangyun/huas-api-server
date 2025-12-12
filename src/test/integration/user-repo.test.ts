/**
 * 集成测试 - UserRepo
 * 测试用户仓储的所有功能点
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { UserRepo } from '../../db/UserRepo';
import { db } from '../../db';

describe('UserRepo 集成测试', () => {
    let repo: UserRepo;
    let testStudentIds: string[] = [];

    beforeEach(() => {
        repo = new UserRepo();
    });

    afterEach(() => {
        // 清理测试数据
        testStudentIds.forEach(id => {
            db.run("DELETE FROM users WHERE student_id = ?", [id]);
        });
        testStudentIds = [];
    });

    describe('保存用户资料', () => {
        test('应该成功保存新用户资料', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            repo.saveProfile(studentId, '张三', '计算机2024-1');
            
            const user = db.prepare("SELECT * FROM users WHERE student_id = ?").get(studentId) as any;
            expect(user).not.toBeNull();
            expect(user.name).toBe('张三');
            expect(user.class_name).toBe('计算机2024-1');
        });

        test('应该更新已存在的用户资料', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            repo.saveProfile(studentId, '旧名字', '旧班级');
            repo.saveProfile(studentId, '新名字', '新班级');
            
            const user = db.prepare("SELECT * FROM users WHERE student_id = ?").get(studentId) as any;
            expect(user.name).toBe('新名字');
            expect(user.class_name).toBe('新班级');
        });

        test('应该设置 last_active_at 时间戳', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            const beforeTime = Date.now();
            
            repo.saveProfile(studentId, '测试', '测试班');
            
            const user = db.prepare("SELECT * FROM users WHERE student_id = ?").get(studentId) as any;
            expect(Number(user.last_active_at)).toBeGreaterThanOrEqual(beforeTime);
        });

        test('应该更新 last_active_at 时间戳', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            repo.saveProfile(studentId, '测试', '测试班');
            const firstActiveTime = Number((db.prepare("SELECT last_active_at FROM users WHERE student_id = ?")
                .get(studentId) as any).last_active_at);
            
            // 等待一小段时间
            const sleepTime = 100;
            const start = Date.now();
            while (Date.now() - start < sleepTime) { /* busy wait */ }
            
            repo.saveProfile(studentId, '测试', '测试班');
            const secondActiveTime = Number((db.prepare("SELECT last_active_at FROM users WHERE student_id = ?")
                .get(studentId) as any).last_active_at);
            
            expect(secondActiveTime).toBeGreaterThan(firstActiveTime);
        });

        test('应该处理包含特殊字符的姓名', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            const specialName = "欧阳·麦克唐纳德's";
            
            repo.saveProfile(studentId, specialName, '测试班');
            
            const user = db.prepare("SELECT * FROM users WHERE student_id = ?").get(studentId) as any;
            expect(user.name).toBe(specialName);
        });

        test('应该处理包含特殊字符的班级名', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            const specialClass = '计算机科学(AI方向)2024-1班';
            
            repo.saveProfile(studentId, '测试', specialClass);
            
            const user = db.prepare("SELECT * FROM users WHERE student_id = ?").get(studentId) as any;
            expect(user.class_name).toBe(specialClass);
        });
    });

    describe('更新活跃时间', () => {
        test('应该成功更新活跃时间', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            repo.saveProfile(studentId, '测试', '测试班');
            const beforeTouch = Number((db.prepare("SELECT last_active_at FROM users WHERE student_id = ?")
                .get(studentId) as any).last_active_at);
            
            // 等待一小段时间
            const sleepTime = 100;
            const start = Date.now();
            while (Date.now() - start < sleepTime) { /* busy wait */ }
            
            repo.touch(studentId);
            const afterTouch = Number((db.prepare("SELECT last_active_at FROM users WHERE student_id = ?")
                .get(studentId) as any).last_active_at);
            
            expect(afterTouch).toBeGreaterThan(beforeTouch);
        });

        test('touch 不应修改姓名和班级', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            repo.saveProfile(studentId, '原始姓名', '原始班级');
            repo.touch(studentId);
            
            const user = db.prepare("SELECT * FROM users WHERE student_id = ?").get(studentId) as any;
            expect(user.name).toBe('原始姓名');
            expect(user.class_name).toBe('原始班级');
        });

        test('touch 不存在的用户不应报错', () => {
            const nonExistentId = `test_nonexistent_${Date.now()}`;
            
            expect(() => repo.touch(nonExistentId)).not.toThrow();
        });

        test('多次 touch 应该持续更新时间', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            repo.saveProfile(studentId, '测试', '测试班');
            
            const times: number[] = [];
            for (let i = 0; i < 3; i++) {
                const sleepTime = 50;
                const start = Date.now();
                while (Date.now() - start < sleepTime) { /* busy wait */ }
                
                repo.touch(studentId);
                const time = Number((db.prepare("SELECT last_active_at FROM users WHERE student_id = ?")
                    .get(studentId) as any).last_active_at);
                times.push(time);
            }
            
            expect(times[1]).toBeGreaterThan(times[0]!);
            expect(times[2]).toBeGreaterThan(times[1]!);
        });
    });

    describe('边界情况', () => {
        test('应该处理空姓名', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            repo.saveProfile(studentId, '', '测试班');
            
            const user = db.prepare("SELECT * FROM users WHERE student_id = ?").get(studentId) as any;
            expect(user.name).toBe('');
        });

        test('应该处理空班级名', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            repo.saveProfile(studentId, '测试', '');
            
            const user = db.prepare("SELECT * FROM users WHERE student_id = ?").get(studentId) as any;
            expect(user.class_name).toBe('');
        });

        test('应该处理超长姓名', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            const longName = '测试'.repeat(50); // 100个字符
            
            repo.saveProfile(studentId, longName, '测试班');
            
            const user = db.prepare("SELECT * FROM users WHERE student_id = ?").get(studentId) as any;
            expect(user.name).toBe(longName);
        });

        test('应该处理超长班级名', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            const longClass = '班级'.repeat(100); // 200个字符
            
            repo.saveProfile(studentId, '测试', longClass);
            
            const user = db.prepare("SELECT * FROM users WHERE student_id = ?").get(studentId) as any;
            expect(user.class_name).toBe(longClass);
        });
    });

    describe('数据一致性', () => {
        test('同一学号不应创建重复记录', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            repo.saveProfile(studentId, '姓名1', '班级1');
            repo.saveProfile(studentId, '姓名2', '班级2');
            
            const users = db.prepare("SELECT COUNT(*) as count FROM users WHERE student_id = ?")
                .get(studentId) as any;
            expect(users.count).toBe(1);
        });

        test('last_active_at 应该在每次更新时增加', () => {
            const studentId = `test_${Date.now()}`;
            testStudentIds.push(studentId);
            
            repo.saveProfile(studentId, '姓名1', '班级1');
            const lastActive1 = Number((db.prepare("SELECT last_active_at FROM users WHERE student_id = ?")
                .get(studentId) as any).last_active_at);
            
            // 等待后再次保存
            const sleepTime = 100;
            const start = Date.now();
            while (Date.now() - start < sleepTime) { /* busy wait */ }
            
            repo.saveProfile(studentId, '姓名2', '班级2');
            const lastActive2 = Number((db.prepare("SELECT last_active_at FROM users WHERE student_id = ?")
                .get(studentId) as any).last_active_at);
            
            expect(lastActive2).toBeGreaterThan(lastActive1);
        });
    });
});
