// src/db/UserRepo.ts
import { db } from './index';

export class UserRepo {
    // 更新用户基本信息
    private updateStmt = db.prepare(`
        INSERT INTO users (student_id, name, class_name, last_active_at, created_at)
        VALUES ($sid, $name, $cls, $time, $time)
        ON CONFLICT(student_id) DO UPDATE SET
            name = $name,
            class_name = $cls,
            last_active_at = $time,
            created_at = COALESCE(users.created_at, excluded.created_at)
    `);

    // 更新活跃时间 (轻量级)
    private touchStmt = db.prepare(`
        UPDATE users SET last_active_at = $time WHERE student_id = $sid
    `);

    /**
     * 同步用户信息到结构化表
     */
    saveProfile(studentId: string, name: string, className: string) {
        this.updateStmt.run({
            $sid: studentId,
            $name: name,
            $cls: className,
            $time: Date.now()
        });
    }

    /**
     * 仅更新最后活跃时间
     */
    touch(studentId: string) {
        this.touchStmt.run({
            $sid: studentId,
            $time: Date.now()
        });
    }
}

export const userRepo = new UserRepo();
