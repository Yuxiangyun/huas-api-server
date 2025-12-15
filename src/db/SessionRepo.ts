// src/db/SessionRepo.ts
import { db } from './index';
import loggerInstance from '../core/utils/Logger';
import { maskToken, maskStudentId } from '../core/security';
import type { DbSession } from '../types';

export class SessionRepo {
    // 创建/更新 Token
    private upsertStmt = db.prepare(`
        INSERT OR REPLACE INTO sessions (token, student_id, cookies, portal_token, execution, user_agent, created_at, updated_at)
        VALUES ($token, $sid, $cookies, $pt, $exec, $ua, $created, $updated)
    `);

    private getStmt = db.prepare(`SELECT * FROM sessions WHERE token = ?`);
    private deleteStmt = db.prepare(`DELETE FROM sessions WHERE token = ?`);

    // 登录成功时，更新用户表（不覆盖已有姓名/班级）
    private upsertUserStmt = db.prepare(`
        INSERT INTO users (student_id, last_active_at, created_at)
        VALUES ($sid, $time, $time)
        ON CONFLICT(student_id) DO UPDATE SET
            last_active_at = excluded.last_active_at,
            created_at = COALESCE(users.created_at, excluded.created_at)
    `);

    // 会话活跃时间刷新
    private touchSessionStmt = db.prepare(`
        UPDATE sessions SET updated_at = $time WHERE token = $token
    `);

    // 用户活跃时间刷新
    private touchUserStmt = db.prepare(`
        UPDATE users SET last_active_at = $time WHERE student_id = $sid
    `);

    /**
     * 初始化一个临时会话 (仅包含验证码上下文)
     */
    createTemp(token: string, cookies: any, execution: string, userAgent?: string, clientIP?: string) {
        const ua = userAgent || 'unknown';
        const ip = clientIP || 'unknown';
        this.upsertStmt.run({
            $token: token,
            $sid: null, // 还没登录
            $cookies: JSON.stringify(cookies),
            $pt: null,
            $exec: execution,
            $ua: `${ua} | ip:${ip}`,
            $created: Date.now(),
            $updated: Date.now()
        });
    }

    /**
     * 登录成功：绑定学号
     * 策略：不删除该学号的其他 Token (多设备共存)
     */
    bindUser(token: string, studentId: string, cookies: any, portalToken: string): boolean {
        // 1. 确保用户表里有这个人
        this.upsertUserStmt.run({ $sid: studentId, $time: Date.now() });

        // 2. 更新当前会话
        const current = this.get(token);
        if (!current) {
            loggerInstance.warn("登录绑定失败：会话不存在", { token: maskToken(token), studentId: maskStudentId(studentId) });
            return false; // 会话不存在则返回失败
        }

        this.upsertStmt.run({
            $token: token,
            $sid: studentId,
            $cookies: JSON.stringify(cookies),
            $pt: portalToken,
            $exec: null, // 登录完了，execution 作废
            $ua: current.user_agent,
            $created: current.created_at, // 保持创建时间
            $updated: Date.now()
        });
        return true;
    }

    /**
     * 获取会话
     */
    get(token: string): DbSession | null {
        const res = this.getStmt.get(token) as any;
        if (!res) return null;
        
        // 🔥 修复：如果 res.cookies 为空，不要 JSON.parse('{}')
        // 直接传 null/undefined，让 NetworkSession 去处理
        let parsedCookies = null;
        try {
            if (res.cookies && res.cookies !== '{}') {
                parsedCookies = JSON.parse(res.cookies);
            }
        } catch {
            parsedCookies = null;
        }

        return {
            ...res,
            cookies: parsedCookies
        };
    }

    /**
     * 删除会话 (退出登录)
     */
    delete(token: string) {
        this.deleteStmt.run(token);
    }

    /**
     * 刷新会话与用户活跃时间，避免被清理任务误删
     */
    touch(token: string, studentId?: string) {
        const now = Date.now();
        this.touchSessionStmt.run({ $token: token, $time: now });
        if (studentId) {
            this.touchUserStmt.run({ $sid: studentId, $time: now });
            loggerInstance.debug("刷新活跃时间", { token: maskToken(token), studentId: maskStudentId(studentId) });
        }
    }
}

export const sessionRepo = new SessionRepo();
