/**
 * 统计数据仓库
 * 提供用户统计、会话统计等功能
 */
import { db } from './index';

/**
 * 用户统计数据接口
 */
export interface UserStats {
    totalUsers: number;           // 总用户数
    activeUsersToday: number;     // 今日活跃用户数
    activeUsersWeek: number;      // 周活跃用户数
    activeUsersMonth: number;     // 月活跃用户数
    newUsersToday: number;        // 今日新增用户数
    newUsersWeek: number;         // 周新增用户数
    newUsersMonth: number;        // 月新增用户数
}

/**
 * 会话统计数据接口
 */
export interface SessionStats {
    totalSessions: number;        // 总会话数
    activeSessions: number;       // 活跃会话数（已登录）
    tempSessions: number;         // 临时会话数（未登录）
    multiDeviceUsers: number;     // 多设备登录用户数
}

/**
 * 缓存统计数据接口
 */
export interface CacheStats {
    totalCacheRecords: number;    // 总缓存记录数
    scheduleCache: number;        // 课表缓存数
    ecardCache: number;           // 一卡通缓存数
    userInfoCache: number;        // 用户信息缓存数
}

/**
 * 系统统计汇总接口
 */
export interface SystemStats {
    user: UserStats;
    session: SessionStats;
    cache: CacheStats;
    timestamp: number;
}

export class StatsRepo {
    /**
     * 获取用户统计数据
     */
    getUserStats(): UserStats {
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
        const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

        // 总用户数
        const totalUsers = db.prepare(`SELECT COUNT(*) as count FROM users`).get() as { count: number };

        // 今日活跃用户数
        const activeToday = db.prepare(`
            SELECT COUNT(*) as count FROM users 
            WHERE last_active_at >= ?
        `).get(oneDayAgo) as { count: number };

        // 周活跃用户数
        const activeWeek = db.prepare(`
            SELECT COUNT(*) as count FROM users 
            WHERE last_active_at >= ?
        `).get(oneWeekAgo) as { count: number };

        // 月活跃用户数
        const activeMonth = db.prepare(`
            SELECT COUNT(*) as count FROM users 
            WHERE last_active_at >= ?
        `).get(oneMonthAgo) as { count: number };

        // 今日新增用户数（假设有 created_at 字段，当前版本暂时返回 0）
        const newToday = 0;
        const newWeek = 0;
        const newMonth = 0;

        return {
            totalUsers: totalUsers.count,
            activeUsersToday: activeToday.count,
            activeUsersWeek: activeWeek.count,
            activeUsersMonth: activeMonth.count,
            newUsersToday: newToday,
            newUsersWeek: newWeek,
            newUsersMonth: newMonth
        };
    }

    /**
     * 获取会话统计数据
     */
    getSessionStats(): SessionStats {
        // 总会话数
        const total = db.prepare(`SELECT COUNT(*) as count FROM sessions`).get() as { count: number };

        // 活跃会话数（已登录）
        const active = db.prepare(`
            SELECT COUNT(*) as count FROM sessions 
            WHERE student_id IS NOT NULL
        `).get() as { count: number };

        // 临时会话数（未登录）
        const temp = db.prepare(`
            SELECT COUNT(*) as count FROM sessions 
            WHERE student_id IS NULL
        `).get() as { count: number };

        // 多设备登录用户数
        const multiDevice = db.prepare(`
            SELECT COUNT(*) as count FROM (
                SELECT student_id FROM sessions 
                WHERE student_id IS NOT NULL 
                GROUP BY student_id 
                HAVING COUNT(*) > 1
            )
        `).get() as { count: number };

        return {
            totalSessions: total.count,
            activeSessions: active.count,
            tempSessions: temp.count,
            multiDeviceUsers: multiDevice.count
        };
    }

    /**
     * 获取缓存统计数据
     */
    getCacheStats(): CacheStats {
        // 总缓存记录数
        const total = db.prepare(`SELECT COUNT(*) as count FROM data_cache`).get() as { count: number };

        // 课表缓存数
        const schedule = db.prepare(`
            SELECT COUNT(*) as count FROM data_cache WHERE type = 'SCHEDULE'
        `).get() as { count: number };

        // 一卡通缓存数
        const ecard = db.prepare(`
            SELECT COUNT(*) as count FROM data_cache WHERE type = 'ECARD'
        `).get() as { count: number };

        // 用户信息缓存数
        const userInfo = db.prepare(`
            SELECT COUNT(*) as count FROM data_cache WHERE type = 'USER_INFO'
        `).get() as { count: number };

        return {
            totalCacheRecords: total.count,
            scheduleCache: schedule.count,
            ecardCache: ecard.count,
            userInfoCache: userInfo.count
        };
    }

    /**
     * 获取系统完整统计数据
     */
    getSystemStats(): SystemStats {
        return {
            user: this.getUserStats(),
            session: this.getSessionStats(),
            cache: this.getCacheStats(),
            timestamp: Date.now()
        };
    }

    /**
     * 获取用户增长趋势（最近30天）
     * 注意：当前版本 users 表没有 created_at 字段，返回空数组
     */
    getUserGrowthTrend(days: number = 30): Array<{ date: string; count: number }> {
        // TODO: 需要在 users 表添加 created_at 字段后实现
        return [];
    }

    /**
     * 获取活跃用户排行榜（按活跃时间）
     */
    getActiveUsersRanking(limit: number = 10): Array<{ studentId: string; name: string | null; lastActiveAt: number }> {
        const results = db.prepare(`
            SELECT student_id, name, last_active_at 
            FROM users 
            WHERE last_active_at IS NOT NULL 
            ORDER BY last_active_at DESC 
            LIMIT ?
        `).all(limit) as Array<{ student_id: string; name: string | null; last_active_at: number }>;

        return results.map(r => ({
            studentId: r.student_id,
            name: r.name,
            lastActiveAt: r.last_active_at
        }));
    }
}

export const statsRepo = new StatsRepo();
