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
            this.client = new HuasClient(token, userSession);
            loggerInstance.debug("从数据库恢复会话状态", { token: maskToken(token) });
        } else {
            this.client = new HuasClient(token);
        }
    }

    /**
     * 实现基类抽象方法：获取用户标识
     */
    protected getUserIdentifier(): string | undefined {
        return this.client.userId;
    }

    /** 获取学号（对外接口） */
    get studentId(): string | undefined {
        return this.client.userId;
    }

    // ========== 业务方法 ==========

    /**
     * 获取课程表
     * @param refresh 是否强制刷新
     */
    async getSchedule(refresh = false) {
        const result = await this.fetchData(
            {
                type: 'SCHEDULE',
                forceRefresh: refresh,
                ttl: BUSINESS_CONFIG.SCHEDULE_TTL
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
                forceRefresh: true,  // 强制刷新
                ttl: 0     // 无缓存
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
    async login(username: string, password: string, captcha: string): Promise<boolean> {
        loggerInstance.info("开始登录流程", { username: maskStudentId(username) });
        
        try {
            const success = await this.client.login(username, password, captcha);
            
            if (success) {
                const sessionRepoInstance = new SessionRepo();
                const studentId = this.client.userId;
                
                if (studentId) {
                    const currentSession = this.client.exportState();
                    sessionRepoInstance.bindUser(
                        this.token, 
                        studentId, 
                        currentSession.cookies, 
                        this.client.portalToken || ''
                    );
                    loggerInstance.info("登录成功", { studentId: maskStudentId(studentId) });
                    return true;
                } else {
                    loggerInstance.error("登录成功但无法获取学号");
                    return false;
                }
            }
            
            loggerInstance.warn("登录验证失败", { username: maskStudentId(username) });
            return false;
        } catch (e: any) {
            loggerInstance.error("登录过程中发生错误", { error: e.message });
            return false;
        }
    }
}