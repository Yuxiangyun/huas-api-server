/**
 * 数据库初始化模块
 * 管理 SQLite 数据库连接和表结构
 */
import { Database } from 'bun:sqlite';
import { DB_CONFIG } from '../config';
import loggerInstance from '../core/utils/Logger';

// 创建数据库单例
const db = new Database(DB_CONFIG.DB_PATH, { create: true });

loggerInstance.info("数据库初始化", { path: DB_CONFIG.DB_PATH });

// 开启 WAL 模式提升并发性能
db.exec("PRAGMA journal_mode = WAL;");
// 避免高并发写锁失败
db.exec("PRAGMA busy_timeout = 5000;");

// 1. 用户表 (User Registry) - 方便未来扩展统计或封禁功能
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    student_id TEXT PRIMARY KEY,
    name TEXT,
    class_name TEXT,
    last_active_at INTEGER,
    created_at INTEGER
  )
`);

// 补充 created_at 列（老表兼容）
try {
  const cols = db.query("PRAGMA table_info(users);").all() as Array<{ name: string; }>;
  const hasCreated = cols.some(c => c.name === 'created_at');
  if (!hasCreated) {
    db.exec(`ALTER TABLE users ADD COLUMN created_at INTEGER;`);
    loggerInstance.info("为 users 表补充 created_at 字段");
  }
} catch (e) {
  loggerInstance.warn("检查/补充 users.created_at 失败", { error: (e as any)?.message });
}

// 2. 会话表 (Session Layer) - 允许多个 Token 指向同一个 user_id
db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    student_id TEXT,
    cookies TEXT,
    portal_token TEXT,
    execution TEXT,
    user_agent TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY(student_id) REFERENCES users(student_id)
  )
`);
// 索引：加速查找某个学生的所有在线设备
db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_sid ON sessions(student_id);`);
// 索引：加速会话清理任务（根据更新时间）
db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at);`);
// 复合索引：加速清理不活跃用户的会话
db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_sid_updated ON sessions(student_id, updated_at);`);

// 3. 数据缓存表 (Data Layer) - 绑定在 student_id 上，多设备共享
db.run(`
  CREATE TABLE IF NOT EXISTS data_cache (
    student_id TEXT,
    type TEXT,
    data TEXT,
    updated_at INTEGER,
    PRIMARY KEY (student_id, type)
  )
`);
// 索引：加速缓存清理任务（根据更新时间）
db.run(`CREATE INDEX IF NOT EXISTS idx_cache_updated ON data_cache(updated_at);`);

export { db };
