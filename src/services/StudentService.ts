/**
 * 学生服务模块
 * 提供课程表、用户信息、一卡通等业务功能
 */
import { BaseService } from './BaseService';
import type { DataParser } from './BaseService';
import { SessionRepo, sessionRepo } from '../db/SessionRepo';
import { UserRepo } from '../db/UserRepo';
import { HuasClient } from '../core/HuasClient';
import { ScheduleParser } from '../parsers/ScheduleParser';
import { ECardParser } from '../parsers/ECardParser';
import { UserParser } from '../parsers/UserParser';
import { GradeParser } from '../parsers/GradeParser';
import { BUSINESS_CONFIG } from '../config';
import { maskStudentId, maskToken } from '../core/security';
import loggerInstance from '../core/utils/Logger';
import type { UserSession } from '../types';

/**
 * 学生服务类
 * 继承基础服务类，实现学生相关业务逻辑
 */
export class StudentService extends BaseService {
    private client: HuasClient;

    constructor(token: string) {
        super(token);
        
        // 从数据库恢复会话状态
        const savedSession = sessionRepo.get(token);
        
        if (savedSession) {
            const userSession: UserSession = {
                id: token,
                cookies: savedSession.cookies,
                portalToken: savedSession.portal_token || undefined,
                execution: savedSession.execution || undefined,
                updatedAt: savedSession.updated_at
            };
            
            // 使用数据库中的 student_id 作为用户标识（学号）
            // 如果会话未绑定用户（未登录），则 userId 将保持为 token（后续会被判断为未登录）
            const userId = savedSession.student_id || token;
            this.client = new HuasClient(userId, userSession);
            
            loggerInstance.debug("从数据库恢复会话状态", { 
                token: maskToken(token),
                hasStudentId: !!savedSession.student_id 
            });
        } else {
            this.client = new HuasClient(token);
        }
    }

    /**
     * 实现基类抽象方法：获取用户标识
     * 返回学号或 undefined（未登录时）
     */
    protected getUserIdentifier(): string | undefined {
        const session = this.sessionRepo.get(this.token);
        return session?.student_id || undefined;
    }

    /** 
     * 获取学号（对外接口）
     * @returns 学号，未登录时返回 undefined
     */
    get studentId(): string | undefined {
        const session = this.sessionRepo.get(this.token);
        return session?.student_id || undefined;
    }

    // ========== 业务方法 ==========

    /**
     * 获取成绩单
     * @param refresh 是否强制刷新
     */
    async getGrades(refresh = false) {
        const result = await this.fetchData(
            {
                type: 'GRADES',
                forceRefresh: true,
                ttl: 0,
                disableCache: true
            },
            () => this.client.fetchGradesRaw(),
            GradeParser
        );

        return { ...result.data, _source: result.source };
    }

    /**
     * 获取课程表
     * @param refresh 是否强制刷新
     */
    async getSchedule(refresh = false) {
        const result = await this.fetchData(
            {
                type: 'SCHEDULE',
                forceRefresh: true,
                ttl: 0,
                disableCache: true
            },
            () => this.client.fetchScheduleRaw(),
            ScheduleParser
        );
        
        return { ...result.data, _source: result.source };
    }

    /**
     * 获取一卡通余额
     * 策略：实时获取，不使用缓存
     */
    async getECard(_refresh = false) {
        const result = await this.fetchData(
            {
                type: 'ECARD',
                forceRefresh: true,
                ttl: 0,
                disableCache: true
            },
            () => this.client.fetchECardRaw(),
            ECardParser
        );
        
        return { ...result.data, _source: result.source };
    }

    /**
     * 获取用户信息
     * @param refresh 是否强制刷新
     */
    async getUserInfo(refresh = false) {
        const result = await this.fetchData(
            {
                type: 'USER_INFO',
                forceRefresh: refresh,
                ttl: BUSINESS_CONFIG.USER_INFO_TTL
            },
            () => this.client.fetchUserInfoRaw(),
            UserParser
        );

        // 如果数据来源是网络，同步更新用户表
        if (result.source === 'network' && this.studentId) {
            setImmediate(() => {
                loggerInstance.info("同步更新用户资料", { studentId: maskStudentId(this.studentId!) });
                const userRepo = new UserRepo();
                userRepo.saveProfile(this.studentId!, result.data.name, result.data.className);
            });
        }

        return { ...result.data, _source: result.source };
    }

    // ========== 登录流程 ==========

    /**
     * 用户登录
     * @param username 学号
     * @param password 密码
     * @param captcha 验证码
     */
    async login(username: string, password: string, captcha: string): Promise<{ success: boolean; needCaptcha?: boolean; }> {
        loggerInstance.info("开始登录流程", { username: maskStudentId(username) });
        
        try {
            const result = await this.client.login(username, password, captcha);
            const success = result.success;
            
            if (success) {
                const sessionRepoInstance = new SessionRepo();
                // 登录账号本身就是学号，作为系统内的唯一用户标识
                const studentId = username;
                // 登录成功后，将客户端内的 userId 统一更新为学号
                // 后续缓存键、日志与统计统一以学号为维度
                this.client.userId = studentId;

                const currentSession = this.client.exportState();
                const bindOk = sessionRepoInstance.bindUser(
                    this.token, 
                    studentId, 
                    currentSession.cookies, 
                    this.client.portalToken || ''
                );
                if (!bindOk) {
                    throw new Error("SESSION_NOT_FOUND");
                }
                loggerInstance.info("登录成功", { studentId: maskStudentId(studentId) });
                return { success: true };
            }
            
            loggerInstance.warn("登录验证失败", { username: maskStudentId(username) });
            if (result.needCaptcha) {
                loggerInstance.warn("登录失败：上游要求验证码", { username: maskStudentId(username) });
            }
            return { success: false, needCaptcha: result.needCaptcha };
        } catch (e: any) {
            loggerInstance.error("登录过程中发生错误", { error: e.message });
            return { success: false };
        }
    }
}
