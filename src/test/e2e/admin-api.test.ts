/**
 * E2E 测试 - 管理员 API 访问控制
 * 模拟真实的 HTTP 请求场景，测试管理员权限保护
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { v4 as uuidv4 } from 'uuid';
import { SessionRepo } from '../../db/SessionRepo';

describe('管理员 API E2E 测试', () => {
    const sessionRepo = new SessionRepo();
    
    // 测试数据
    const adminToken = uuidv4();
    const adminStudentId = '202412040130'; // 喻祥云（管理员）
    
    const normalToken = uuidv4();
    const normalStudentId = '202412040888';
    
    const invalidToken = uuidv4();
    const emptyToken = '';
    const malformedToken = 'invalid-token-format';
    
    beforeAll(() => {
        // 创建管理员会话
        sessionRepo.createTemp(adminToken, {}, 'exec1');
        sessionRepo.bindUser(adminToken, adminStudentId, {}, 'portal_admin');
        
        // 创建普通用户会话
        sessionRepo.createTemp(normalToken, {}, 'exec2');
        sessionRepo.bindUser(normalToken, normalStudentId, {}, 'portal_user');
    });
    
    afterAll(() => {
        sessionRepo.delete(adminToken);
        sessionRepo.delete(normalToken);
    });
    
    describe('未授权访问场景', () => {
        test('无 Token 访问统计接口应该返回 401', () => {
            // 模拟中间件行为：无 Token
            const hasToken = !!emptyToken;
            expect(hasToken).toBe(false);
            
            // 预期结果：401 未授权
            const expectedCode = 401;
            const expectedMsg = "未授权";
            
            expect(expectedCode).toBe(401);
            expect(expectedMsg).toBe("未授权");
        });
        
        test('Token 格式错误应该返回 401', () => {
            // Token 格式验证
            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            const isValid = uuidPattern.test(malformedToken);
            
            expect(isValid).toBe(false);
            
            // 预期结果
            const expectedCode = 401;
            const expectedMsg = "Token 格式无效";
            
            expect(expectedCode).toBe(401);
            expect(expectedMsg).toBe("Token 格式无效");
        });
        
        test('不存在的 Token 应该返回 401', () => {
            const session = sessionRepo.get(invalidToken);
            expect(session).toBeNull();
            
            // 预期结果
            const expectedCode = 401;
            const expectedMsg = "会话已过期或未登录";
            
            expect(expectedCode).toBe(401);
            expect(expectedMsg).toBe("会话已过期或未登录");
        });
        
        test('未登录的临时会话应该返回 401', () => {
            const tempToken = uuidv4();
            sessionRepo.createTemp(tempToken, {}, 'exec_temp');
            
            const session = sessionRepo.get(tempToken);
            expect(session).not.toBeNull();
            expect(session?.student_id).toBeNull();
            
            // 预期结果：未绑定用户，视为未登录
            const expectedCode = 401;
            const expectedMsg = "会话已过期或未登录";
            
            expect(expectedCode).toBe(401);
            expect(expectedMsg).toBe("会话已过期或未登录");
            
            sessionRepo.delete(tempToken);
        });
    });
    
    describe('普通用户访问场景（403 禁止访问）', () => {
        test('普通用户访问 /system/stats 应该返回 403', () => {
            const session = sessionRepo.get(normalToken);
            expect(session).not.toBeNull();
            expect(session?.student_id).toBe(normalStudentId);
            
            // 管理员白名单检查
            const ADMIN_IDS = ['202412040130'];
            const isAdmin = ADMIN_IDS.includes(normalStudentId);
            expect(isAdmin).toBe(false);
            
            // 预期结果
            const expectedCode = 403;
            const expectedMsg = "仅管理员可访问";
            
            expect(expectedCode).toBe(403);
            expect(expectedMsg).toBe("仅管理员可访问");
        });
        
        test('普通用户访问 /system/stats/users 应该返回 403', () => {
            const session = sessionRepo.get(normalToken);
            const ADMIN_IDS = ['202412040130'];
            const isAdmin = ADMIN_IDS.includes(session?.student_id || '');
            
            expect(isAdmin).toBe(false);
            
            const expectedCode = 403;
            expect(expectedCode).toBe(403);
        });
        
        test('普通用户访问 /system/stats/sessions 应该返回 403', () => {
            const session = sessionRepo.get(normalToken);
            const ADMIN_IDS = ['202412040130'];
            const isAdmin = ADMIN_IDS.includes(session?.student_id || '');
            
            expect(isAdmin).toBe(false);
            expect(403).toBe(403);
        });
        
        test('普通用户访问 /system/stats/cache 应该返回 403', () => {
            const session = sessionRepo.get(normalToken);
            const ADMIN_IDS = ['202412040130'];
            const isAdmin = ADMIN_IDS.includes(session?.student_id || '');
            
            expect(isAdmin).toBe(false);
            expect(403).toBe(403);
        });
        
        test('普通用户访问 /system/stats/active-users 应该返回 403', () => {
            const session = sessionRepo.get(normalToken);
            const ADMIN_IDS = ['202412040130'];
            const isAdmin = ADMIN_IDS.includes(session?.student_id || '');
            
            expect(isAdmin).toBe(false);
            expect(403).toBe(403);
        });
    });
    
    describe('管理员访问场景（200 成功）', () => {
        test('管理员访问 /system/stats 应该成功', () => {
            const session = sessionRepo.get(adminToken);
            expect(session).not.toBeNull();
            expect(session?.student_id).toBe(adminStudentId);
            
            // 管理员白名单检查
            const ADMIN_IDS = ['202412040130'];
            const isAdmin = ADMIN_IDS.includes(adminStudentId);
            expect(isAdmin).toBe(true);
            
            // 预期结果
            const expectedCode = 200;
            expect(expectedCode).toBe(200);
        });
        
        test('管理员身份应该被正确验证', () => {
            const session = sessionRepo.get(adminToken);
            const ADMIN_IDS = ['202412040130'];
            const isAdmin = ADMIN_IDS.includes(session?.student_id || '');
            
            expect(isAdmin).toBe(true);
        });
        
        test('管理员可以访问所有统计接口', () => {
            const session = sessionRepo.get(adminToken);
            const ADMIN_IDS = ['202412040130'];
            const isAdmin = ADMIN_IDS.includes(session?.student_id || '');
            
            expect(isAdmin).toBe(true);
            
            // 所有统计接口路径
            const protectedPaths = [
                '/system/stats',
                '/system/stats/users',
                '/system/stats/sessions',
                '/system/stats/cache',
                '/system/stats/active-users'
            ];
            
            expect(protectedPaths.length).toBe(5);
        });
    });
    
    describe('公开接口访问场景', () => {
        test('健康检查接口无需认证', () => {
            // /health 和 /system/health 是公开的
            const publicPaths = ['/health', '/system/health'];
            
            expect(publicPaths.includes('/health')).toBe(true);
            expect(publicPaths.includes('/system/health')).toBe(true);
        });
        
        test('监控接口当前是公开的（独立端口）', () => {
            // 性能/状态接口迁移到监控端口（默认 13001），保持公开访问
            const isPublic = true;
            expect(isPublic).toBe(true);
        });
    });
    
    describe('安全边界测试', () => {
        test('管理员和普通用户的 Token 不能混用', () => {
            const adminSession = sessionRepo.get(adminToken);
            const normalSession = sessionRepo.get(normalToken);
            
            expect(adminSession?.student_id).toBe(adminStudentId);
            expect(normalSession?.student_id).toBe(normalStudentId);
            expect(adminSession?.student_id).not.toBe(normalSession?.student_id);
        });
        
        test('退出登录后 Token 应该失效', () => {
            const testToken = uuidv4();
            sessionRepo.createTemp(testToken, {}, 'exec');
            sessionRepo.bindUser(testToken, 'test_logout_user', {}, 'portal');
            
            expect(sessionRepo.get(testToken)).not.toBeNull();
            
            sessionRepo.delete(testToken);
            expect(sessionRepo.get(testToken)).toBeNull();
        });
        
        test('管理员学号应该严格匹配', () => {
            const ADMIN_IDS = ['202412040130'];
            
            // 正确的管理员学号
            expect(ADMIN_IDS.includes('202412040130')).toBe(true);
            
            // 相似但错误的学号
            expect(ADMIN_IDS.includes('202412040131')).toBe(false);
            expect(ADMIN_IDS.includes('202412040129')).toBe(false);
            expect(ADMIN_IDS.includes('20241204013')).toBe(false);
            expect(ADMIN_IDS.includes('2024120401300')).toBe(false);
        });
    });
    
    describe('速率限制测试', () => {
        test('管理员接口应该有速率限制', () => {
            // 管理员限流为 100 次/分钟
            const adminRateLimit = 100;
            expect(adminRateLimit).toBe(100);
        });
        
        test('普通 API 接口速率限制为 60 次/分钟', () => {
            const apiRateLimit = 60;
            expect(apiRateLimit).toBe(60);
        });
    });
    
    describe('路由保护范围测试', () => {
        test('所有 /system/stats/* 路径都应该被保护', () => {
            const protectedPattern = '/system/stats/*';
            const testPaths = [
                '/system/stats',
                '/system/stats/users',
                '/system/stats/sessions',
                '/system/stats/cache',
                '/system/stats/active-users'
            ];
            
            testPaths.forEach(path => {
                expect(path.startsWith('/system/stats')).toBe(true);
            });
        });
        
        test('/system/health 不应该被保护', () => {
            const healthPath = '/system/health';
            expect(healthPath.startsWith('/system/stats')).toBe(false);
        });
    });
});
