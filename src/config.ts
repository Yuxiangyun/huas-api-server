/**
 * 应用配置模块
 * 集中管理所有环境变量和配置项
 */

// 服务器配置
export const SERVER_CONFIG = {
    /** 服务器端口 */
    PORT: parseInt(process.env.PORT || '3000'),
    
    /** 允许的 CORS 来源列表 */
    CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
    
    /** 是否为开发环境 */
    IS_DEV: process.env.NODE_ENV !== 'production',
};

// 数据库配置
export const DB_CONFIG = {
    /** SQLite 数据库文件路径 */
    DB_PATH: process.env.DB_PATH || 'huas.sqlite',
};

// 安全配置
export const SECURITY_CONFIG = {
    /** Token 格式正则 (UUID v4) */
    TOKEN_PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    
    /** 登录请求速率限制 (每分钟最大尝试次数) */
    LOGIN_RATE_LIMIT: parseInt(process.env.LOGIN_RATE_LIMIT || '10'),
    
    /** 验证码请求速率限制 (每分钟最大请求次数) */
    CAPTCHA_RATE_LIMIT: parseInt(process.env.CAPTCHA_RATE_LIMIT || '20'),
    
    /** API 请求速率限制 (每分钟最大请求次数) */
    API_RATE_LIMIT: parseInt(process.env.API_RATE_LIMIT || '60'),
    
    /** 速率限制时间窗口 (毫秒) */
    RATE_LIMIT_WINDOW: 60 * 1000,
    
    /** 管理员学号白名单（逗号分隔）*/
    ADMIN_STUDENT_IDS: (process.env.ADMIN_STUDENT_IDS || '202412040130').split(',').map(id => id.trim()),
};

// 日志配置
export const LOG_CONFIG = {
    /** 日志级别: DEBUG, INFO, WARN, ERROR */
    LEVEL: process.env.LOG_LEVEL || 'INFO',
    
    /** 日志文件路径 */
    FILE_PATH: process.env.LOG_FILE_PATH || './logs/app.log',
    
    /** 是否启用控制台输出 */
    ENABLE_CONSOLE: process.env.LOG_ENABLE_CONSOLE !== 'false',
    
    /** 是否启用文件输出 */
    ENABLE_FILE: process.env.LOG_ENABLE_FILE !== 'false',
};

// 业务配置
export const BUSINESS_CONFIG = {
    /** 课表缓存 TTL (秒) */
    SCHEDULE_TTL: 3600,
    
    /** 用户信息缓存 TTL (秒) */
    USER_INFO_TTL: 2592000,
    
    /** 一卡通缓存 TTL (秒) */
    ECARD_TTL: 86400,
    
    /** 僵尸会话清理时间 (分钟) */
    ZOMBIE_SESSION_TIMEOUT: 10,
    
    /** 不活跃会话清理时间 (天) */
    INACTIVE_SESSION_TIMEOUT: 90,
    
    /** 过期缓存清理时间 (天) */
    CACHE_EXPIRY_DAYS: 60,
};

// 教务系统 API 配置
export const JW_CONFIG = {
    /** 教务系统课表参数 (学校特定) */
    SJMS_VALUE: '94CA0081978330A1E05320001AAC856E',
};