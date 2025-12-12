// src/db/CacheRepo.ts
import { db } from './index';
import type { DbCache } from '../types';

export class CacheRepo {
    private upsertStmt = db.prepare(`
        INSERT OR REPLACE INTO data_cache (student_id, type, data, updated_at)
        VALUES ($sid, $type, $data, $time)
    `);

    private getStmt = db.prepare(`
        SELECT data, updated_at FROM data_cache 
        WHERE student_id = $sid AND type = $type
    `);

    /**
     * 写入缓存
     */
    set(studentId: string, type: string, data: any) {
        this.upsertStmt.run({
            $sid: studentId,
            $type: type,
            $data: JSON.stringify(data),
            $time: Date.now()
        });
    }

    /**
     * 读取缓存
     * @param ttlSeconds 有效期(秒)。传 0 或不传则不检查过期。
     */
    get<T>(studentId: string, type: string, ttlSeconds: number = 0): T | null {
        const res = this.getStmt.get({ $sid: studentId, $type: type }) as DbCache;
        
        if (!res) return null;

        // 检查过期 (如果 ttl > 0)
        if (ttlSeconds > 0) {
            const ageSeconds = (Date.now() - res.updated_at) / 1000;
            if (ageSeconds > ttlSeconds) return null;
        }

        try {
            return JSON.parse(res.data);
        } catch {
            return null;
        }
    }

    /**
     * 删除缓存
     * @param studentId 学号
     * @param type 可选，指定类型则仅删除该类型
     */
    delete(studentId: string, type?: string) {
        if (type) {
            db.prepare(`DELETE FROM data_cache WHERE student_id = ? AND type = ?`).run(studentId, type);
        } else {
            db.prepare(`DELETE FROM data_cache WHERE student_id = ?`).run(studentId);
        }
    }
}

export const dataCacheRepo = new CacheRepo();
