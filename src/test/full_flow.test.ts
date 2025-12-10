/**
 * 全流程集成测试
 * 测试内容：登录流程、缓存机制、会话管理
 * 
 * 运行方式：bun src/test/full_flow.test.ts
 */

import { db } from '../db/index';
import { SessionRepo, sessionRepo } from '../db/SessionRepo';
import { CacheRepo, dataCacheRepo } from '../db/CacheRepo';
import { UserRepo, userRepo } from '../db/UserRepo';
import { v4 as uuidv4 } from 'uuid';
import loggerInstance from '../core/utils/Logger';

// 测试结果统计
let passCount = 0;
let failCount = 0;

// 测试辅助函数
function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
        passCount++;
        loggerInstance.info(`✅ 通过: ${testName}`);
    } else {
        failCount++;
        loggerInstance.error(`❌ 失败: ${testName}`, { detail });
    }
}

function assertThrows(fn: () => any, testName: string) {
    try {
        fn();
        failCount++;
        loggerInstance.error(`❌ 失败: ${testName} - 应该抛出异常但没有`);
    } catch (e) {
        passCount++;
        loggerInstance.info(`✅ 通过: ${testName}`);
    }
}

async function assertThrowsAsync(fn: () => Promise<any>, testName: string) {
    try {
        await fn();
        failCount++;
        loggerInstance.error(`❌ 失败: ${testName} - 应该抛出异常但没有`);
    } catch (e) {
        passCount++;
        loggerInstance.info(`✅ 通过: ${testName}`);
    }
}

// 清理测试数据
function cleanupTestData() {
    loggerInstance.info("清理测试数据...");
    db.run("DELETE FROM sessions WHERE token LIKE 'test-%'");
    db.run("DELETE FROM users WHERE student_id LIKE 'test-%'");
    db.run("DELETE FROM data_cache WHERE student_id LIKE 'test-%'");
}

// ========== 测试套件 ==========

async function testSessionRepo() {
    loggerInstance.info("\n========== 测试 SessionRepo ==========");
    
    const repo = new SessionRepo();
    const testToken = `test-${uuidv4()}`;
    
    // 测试1: 创建临时会话
    repo.createTemp(testToken, { testCookie: 'value' }, 'exec-123');
    const session1 = repo.get(testToken);
    assert(session1 !== null, "创建临时会话");
    assert(session1?.student_id === null, "临时会话的 student_id 为空");
    assert(session1?.execution === 'exec-123', "临时会话包含 execution");
    
    // 测试2: 绑定用户
    const testStudentId = `test-${Date.now()}`;
    repo.bindUser(testToken, testStudentId, { authCookie: 'logged' }, 'portal-token-xxx');
    const session2 = repo.get(testToken);
    assert(session2?.student_id === testStudentId, "绑定用户后 student_id 正确");
    assert(session2?.portal_token === 'portal-token-xxx', "绑定用户后 portal_token 正确");
    assert(session2?.execution === null, "绑定用户后 execution 已清空");
    
    // 测试3: 删除会话
    repo.delete(testToken);
    const session3 = repo.get(testToken);
    assert(session3 === null, "删除会话后查询返回 null");
    
    // 测试4: 查询不存在的会话
    const nonExistent = repo.get('non-existent-token');
    assert(nonExistent === null, "查询不存在的会话返回 null");
}

async function testCacheRepo() {
    loggerInstance.info("\n========== 测试 CacheRepo ==========");
    
    const repo = new CacheRepo();
    const testStudentId = `test-${Date.now()}`;
    
    // 测试1: 写入和读取缓存
    const scheduleData = {
        courses: [
            { name: '高等数学', teacher: '张教授', day: 1, section: '1-2' },
            { name: '英语', teacher: '李老师', day: 2, section: '3-4' }
        ]
    };
    repo.set(testStudentId, 'SCHEDULE', scheduleData);
    
    const cached1 = repo.get<typeof scheduleData>(testStudentId, 'SCHEDULE', 0);
    assert(cached1 !== null, "读取缓存成功");
    assert(cached1?.courses?.length === 2, "缓存数据内容正确");
    assert(cached1?.courses?.[0]?.name === '高等数学', "缓存课程名称正确");
    
    // 测试2: 缓存不过期 (TTL = 0)
    const cached2 = repo.get<typeof scheduleData>(testStudentId, 'SCHEDULE', 0);
    assert(cached2 !== null, "TTL=0 时缓存不过期");
    
    // 测试3: 缓存过期检测 (模拟)
    // 更新缓存时间为1秒前
    db.run(`
        UPDATE data_cache 
        SET updated_at = ? 
        WHERE student_id = ? AND type = 'SCHEDULE'
    `, [Date.now() - 2000, testStudentId]); // 2秒前
    
    const cached3 = repo.get<typeof scheduleData>(testStudentId, 'SCHEDULE', 1);
    assert(cached3 === null, "缓存过期后返回 null (TTL=1秒)");
    
    // 测试4: 读取不存在的缓存
    const nonExistent = repo.get<any>('non-existent', 'SCHEDULE', 0);
    assert(nonExistent === null, "读取不存在的缓存返回 null");
    
    // 测试5: 覆盖写入
    const newData = { courses: [{ name: '物理', teacher: '王老师', day: 3, section: '5-6' }] };
    repo.set(testStudentId, 'SCHEDULE', newData);
    const cached4 = repo.get<typeof newData>(testStudentId, 'SCHEDULE', 0);
    assert(cached4?.courses?.length === 1, "覆盖写入后数据正确");
    assert(cached4?.courses?.[0]?.name === '物理', "覆盖写入后课程名称正确");
}

async function testUserRepo() {
    loggerInstance.info("\n========== 测试 UserRepo ==========");
    
    const repo = new UserRepo();
    const testStudentId = `test-${Date.now()}`;
    
    // 测试1: 保存用户资料
    repo.saveProfile(testStudentId, '测试用户', '软件工程2401');
    
    const user = db.prepare("SELECT * FROM users WHERE student_id = ?").get(testStudentId) as any;
    assert(user !== null, "保存用户资料成功");
    assert(user?.name === '测试用户', "用户姓名正确");
    assert(user?.class_name === '软件工程2401', "班级名称正确");
    
    // 测试2: 更新用户资料
    const oldActiveTime = user?.last_active_at;
    await new Promise(r => setTimeout(r, 100)); // 等待一小段时间
    repo.saveProfile(testStudentId, '更新后的名字', '计算机2402');
    
    const updatedUser = db.prepare("SELECT * FROM users WHERE student_id = ?").get(testStudentId) as any;
    assert(updatedUser?.name === '更新后的名字', "更新后的姓名正确");
    assert(updatedUser?.class_name === '计算机2402', "更新后的班级正确");
    assert(updatedUser?.last_active_at > oldActiveTime, "最后活跃时间已更新");
    
    // 测试3: 仅更新活跃时间
    const beforeTouch = updatedUser?.last_active_at;
    await new Promise(r => setTimeout(r, 100));
    repo.touch(testStudentId);
    
    const afterTouch = db.prepare("SELECT * FROM users WHERE student_id = ?").get(testStudentId) as any;
    assert(afterTouch?.last_active_at > beforeTouch, "touch 方法更新了活跃时间");
    assert(afterTouch?.name === '更新后的名字', "touch 不改变姓名");
}

async function testCacheWithSession() {
    loggerInstance.info("\n========== 测试缓存与会话联动 ==========");
    
    const sessionRepo = new SessionRepo();
    const cacheRepo = new CacheRepo();
    const testToken = `test-${uuidv4()}`;
    const testStudentId = `test-student-${Date.now()}`;
    
    // 1. 创建会话并绑定用户
    sessionRepo.createTemp(testToken, {}, '');
    sessionRepo.bindUser(testToken, testStudentId, { auth: 'ok' }, 'pt-123');
    
    // 2. 为该用户写入缓存
    const userData = { name: '张三', className: '计算机2401' };
    cacheRepo.set(testStudentId, 'USER_INFO', userData);
    
    const scheduleData = { courses: [{ name: '数据结构', day: 1 }] };
    cacheRepo.set(testStudentId, 'SCHEDULE', scheduleData);
    
    // 3. 验证缓存读取
    const cachedUser = cacheRepo.get<typeof userData>(testStudentId, 'USER_INFO', 0);
    const cachedSchedule = cacheRepo.get<typeof scheduleData>(testStudentId, 'SCHEDULE', 0);
    
    assert(cachedUser?.name === '张三', "用户信息缓存正确");
    assert(cachedSchedule?.courses?.[0]?.name === '数据结构', "课表缓存正确");
    
    // 4. 验证会话状态
    const session = sessionRepo.get(testToken);
    assert(session?.student_id === testStudentId, "会话关联的学号正确");
    
    // 5. 模拟多设备共享缓存
    const anotherToken = `test-${uuidv4()}`;
    sessionRepo.createTemp(anotherToken, {}, '');
    sessionRepo.bindUser(anotherToken, testStudentId, { auth: 'ok2' }, 'pt-456');
    
    // 两个会话应该共享同一份缓存
    const session1 = sessionRepo.get(testToken);
    const session2 = sessionRepo.get(anotherToken);
    assert(session1?.student_id === session2?.student_id, "多设备会话共享同一学号");
    
    const sharedCache = cacheRepo.get<typeof userData>(testStudentId, 'USER_INFO', 0);
    assert(sharedCache?.name === '张三', "多设备共享缓存数据");
}

async function testCacheTTL() {
    loggerInstance.info("\n========== 测试缓存 TTL 机制 ==========");
    
    const repo = new CacheRepo();
    const testStudentId = `test-ttl-${Date.now()}`;
    
    // 1. 写入缓存
    repo.set(testStudentId, 'ECARD', { balance: 100.50 });
    
    // 2. 立即读取 (应该命中)
    const immediate = repo.get<any>(testStudentId, 'ECARD', 3600);
    assert(immediate?.balance === 100.50, "立即读取缓存命中");
    
    // 3. 模拟缓存过期 (手动修改 updated_at)
    const expiredTime = Date.now() - (3601 * 1000); // 超过1小时
    db.run(`
        UPDATE data_cache SET updated_at = ? 
        WHERE student_id = ? AND type = 'ECARD'
    `, [expiredTime, testStudentId]);
    
    const expired = repo.get<any>(testStudentId, 'ECARD', 3600);
    assert(expired === null, "过期缓存返回 null");
    
    // 4. TTL = 0 应该忽略过期
    const noTTL = repo.get<any>(testStudentId, 'ECARD', 0);
    assert(noTTL?.balance === 100.50, "TTL=0 时忽略过期检查");
}

async function testSessionCleanupScenarios() {
    loggerInstance.info("\n========== 测试会话清理场景 ==========");
    
    const repo = new SessionRepo();
    
    // 1. 创建一个正常会话
    const normalToken = `test-normal-${uuidv4()}`;
    repo.createTemp(normalToken, {}, 'exec1');
    repo.bindUser(normalToken, 'test-normal-student', {}, 'pt1');
    
    // 2. 创建一个僵尸会话 (未绑定用户)
    const zombieToken = `test-zombie-${uuidv4()}`;
    repo.createTemp(zombieToken, {}, 'exec2');
    
    // 3. 验证两个会话都存在
    assert(repo.get(normalToken) !== null, "正常会话存在");
    assert(repo.get(zombieToken) !== null, "僵尸会话存在");
    
    // 4. 模拟清理僵尸会话 (手动更新时间为10分钟前)
    const oldTime = Date.now() - (11 * 60 * 1000); // 11分钟前
    db.run(`
        UPDATE sessions SET updated_at = ? 
        WHERE token = ?
    `, [oldTime, zombieToken]);
    
    // 5. 执行清理 (模拟 Scheduler 逻辑)
    db.run(`
        DELETE FROM sessions 
        WHERE student_id IS NULL 
        AND updated_at < ?
    `, [Date.now() - 10 * 60 * 1000]);
    
    // 6. 验证结果
    assert(repo.get(normalToken) !== null, "正常会话仍然存在");
    assert(repo.get(zombieToken) === null, "僵尸会话已被清理");
}

async function testDataIntegrity() {
    loggerInstance.info("\n========== 测试数据完整性 ==========");
    
    const cacheRepo = new CacheRepo();
    const testStudentId = `test-integrity-${Date.now()}`;
    
    // 1. 写入复杂数据结构
    const complexData = {
        courses: [
            {
                name: '高等数学（上）',
                teacher: '张三',
                location: '教学楼A-301',
                day: 1,
                section: '1-2',
                weekStr: '1-16周'
            },
            {
                name: '大学英语',
                teacher: '李四',
                location: '外语楼B-201',
                day: 2,
                section: '3-4',
                weekStr: '1-18周(单周)'
            }
        ],
        totalCredits: 5.0,
        semester: '2024-2025-1'
    };
    
    cacheRepo.set(testStudentId, 'SCHEDULE', complexData);
    
    // 2. 读取并验证
    const cached = cacheRepo.get<typeof complexData>(testStudentId, 'SCHEDULE', 0);
    
    assert(cached?.courses?.length === 2, "课程数量正确");
    assert(cached?.courses?.[0]?.name === '高等数学（上）', "课程名称正确（含括号）");
    assert(cached?.courses?.[0]?.teacher === '张三', "教师名称正确");
    assert(cached?.courses?.[1]?.weekStr === '1-18周(单周)', "周次字符串正确");
    assert(cached?.totalCredits === 5.0, "学分数字正确");
    assert(cached?.semester === '2024-2025-1', "学期字符串正确");
    
    // 3. 测试特殊字符
    const specialData = {
        note: '包含"引号"和\'单引号\'以及\\反斜杠',
        unicode: '中文测试🎓👨‍🎓',
        newline: '第一行\n第二行'
    };
    cacheRepo.set(testStudentId, 'NOTES', specialData);
    
    const cachedSpecial = cacheRepo.get<typeof specialData>(testStudentId, 'NOTES', 0);
    assert(cachedSpecial?.note?.includes('"引号"') === true, "引号字符正确");
    assert(cachedSpecial?.unicode?.includes('🎓') === true, "Emoji 字符正确");
    assert(cachedSpecial?.newline?.includes('\n') === true, "换行符正确");
}

// ========== 主函数 ==========

async function runAllTests() {
    loggerInstance.info("========================================");
    loggerInstance.info("开始执行全流程集成测试");
    loggerInstance.info("========================================");
    
    // 清理旧的测试数据
    cleanupTestData();
    
    try {
        // 执行所有测试套件
        await testSessionRepo();
        await testCacheRepo();
        await testUserRepo();
        await testCacheWithSession();
        await testCacheTTL();
        await testSessionCleanupScenarios();
        await testDataIntegrity();
        
    } catch (e: any) {
        loggerInstance.error("测试执行过程中发生未捕获的错误", { error: e.message, stack: e.stack });
    } finally {
        // 清理测试数据
        cleanupTestData();
    }
    
    // 输出测试结果
    loggerInstance.info("\n========================================");
    loggerInstance.info("测试执行完成");
    loggerInstance.info(`✅ 通过: ${passCount} 项`);
    loggerInstance.info(`❌ 失败: ${failCount} 项`);
    loggerInstance.info(`📊 通过率: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
    loggerInstance.info("========================================");
    
    // 返回退出码
    if (failCount > 0) {
        process.exit(1);
    }
}

// 执行测试
runAllTests();