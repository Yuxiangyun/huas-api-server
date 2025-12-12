/**
 * 定时任务调度器
 * 负责清理过期会话、缓存等维护任务
 */
import { db } from '../db';
import { BUSINESS_CONFIG } from '../config';
import loggerInstance from './utils/Logger';

const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * ONE_MINUTE;
const ONE_DAY = 24 * ONE_HOUR;

export class Scheduler {
    private timer: Timer | null = null;

    /**
     * 启动调度器
     */
    start(): void {
        loggerInstance.info("调度器已启动：清理任务已安排");
        // 每小时运行一次清理任务
        this.timer = setInterval(() => this.runCleanup(), ONE_HOUR);
        // 启动时立即运行一次
        this.runCleanup();
    }

    /**
     * 停止调度器
     */
    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            loggerInstance.info("调度器已停止");
        }
    }

    /**
     * 执行清理任务
     */
    private runCleanup(): void {
        const now = Date.now();
        loggerInstance.info("运行维护任务", { timestamp: new Date().toISOString() });

        // 1. 清理僵尸临时会话（未登录但超时）
        const zombieTimeout = BUSINESS_CONFIG.ZOMBIE_SESSION_TIMEOUT * ONE_MINUTE;
        const tempRes = db.run(`
            DELETE FROM sessions 
            WHERE student_id IS NULL 
            AND updated_at < ?
        `, [now - zombieTimeout]);
        
        if (tempRes.changes > 0) {
            loggerInstance.info("清理僵尸临时会话", { count: tempRes.changes });
        }

        // 2. 清理长期不活跃会话
        const inactiveTimeout = BUSINESS_CONFIG.INACTIVE_SESSION_TIMEOUT * ONE_DAY;
        const inactiveRes = db.run(`
            DELETE FROM sessions 
            WHERE updated_at < ?
        `, [now - inactiveTimeout]);

        if (inactiveRes.changes > 0) {
            loggerInstance.info("清理不活跃会话", { count: inactiveRes.changes, days: BUSINESS_CONFIG.INACTIVE_SESSION_TIMEOUT });
        }

        // 3. 清理过期缓存数据（按统一超时）
        const cacheTimeout = BUSINESS_CONFIG.CACHE_EXPIRY_DAYS * ONE_DAY;
        const cacheRes = db.run(`
            DELETE FROM data_cache 
            WHERE updated_at < ?
        `, [now - cacheTimeout]);

        if (cacheRes.changes > 0) {
            loggerInstance.info("清理过期缓存", { count: cacheRes.changes, days: BUSINESS_CONFIG.CACHE_EXPIRY_DAYS });
        }
    }
}

/** 调度器单例 */
export const scheduler = new Scheduler();
