import fs from 'fs';
import path from 'path';

// 日志级别枚举
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

// 日志条目接口
interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    meta?: any;
}

// 日志配置接口
interface LoggerConfig {
    level: LogLevel;
    filePath?: string;
    enableConsole: boolean;
    enableFile: boolean;
}

export class Logger {
    private config: LoggerConfig;
    private logStream: fs.WriteStream | null = null;
    private tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    constructor(config?: Partial<LoggerConfig>) {
        const defaultConfig: LoggerConfig = {
            level: LogLevel.INFO,
            enableConsole: true,
            enableFile: false
        };
        this.config = { ...defaultConfig, ...config };
        
        // 创建日志目录
        if (this.config.enableFile && this.config.filePath) {
            const logDir = path.dirname(this.config.filePath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            // 创建写入流
            this.logStream = fs.createWriteStream(this.config.filePath, { flags: 'a' });
        }
    }

    // 格式化日志消息
    private formatLog(level: string, message: string, meta?: any): string {
        const timestamp = new Date().toISOString();
        const sanitizedMeta = meta ? this.sanitizeMeta(meta) : undefined;
        let logEntry: LogEntry = {
            timestamp,
            level,
            message,
            meta: sanitizedMeta
        };

        let serialized = JSON.stringify(logEntry);
        const MAX_LEN = 2000;
        if (serialized.length > MAX_LEN) {
            logEntry = { ...logEntry, meta: '__omitted__(too_large)' };
            serialized = JSON.stringify(logEntry);
        }
        
        return serialized;
    }

    // 脱敏/裁剪 meta
    private sanitizeMeta(meta: any): any {
        const maskValue = (val: string) => {
            if (!val) return val;
            if (this.tokenPattern.test(val)) return val.substring(0, 8) + '...';
            if (/^\d{8,12}$/.test(val)) return val.substring(0, 4) + '****' + val.substring(val.length - 2);
            if (val.length > 200) return val.substring(0, 200) + '...';
            return val;
        };

        if (typeof meta === 'string') return maskValue(meta);
        if (Array.isArray(meta)) return meta.map(m => this.sanitizeMeta(m));
        if (meta && typeof meta === 'object') {
            const obj: any = {};
            Object.entries(meta).forEach(([k, v]) => {
                if (k.toLowerCase().includes('token') || k.toLowerCase().includes('cookie')) {
                    obj[k] = '__hidden__';
                } else if (typeof v === 'string') {
                    obj[k] = maskValue(v);
                } else {
                    obj[k] = this.sanitizeMeta(v);
                }
            });
            return obj;
        }
        return meta;
    }

    // 写入日志
    private writeLog(level: LogLevel, levelStr: string, message: string, meta?: any) {
        // 检查日志级别
        if (level < this.config.level) {
            return;
        }

        const formattedMessage = this.formatLog(levelStr, message, meta);

        // 控制台输出
        if (this.config.enableConsole) {
            const consoleMessage = `[${new Date().toISOString()}] [${levelStr}] ${message}`;
            switch (level) {
                case LogLevel.DEBUG:
                    console.debug(consoleMessage);
                    break;
                case LogLevel.INFO:
                    console.info(consoleMessage);
                    break;
                case LogLevel.WARN:
                    console.warn(consoleMessage);
                    break;
                case LogLevel.ERROR:
                    console.error(consoleMessage);
                    break;
            }
        }

        // 文件输出
        if (this.config.enableFile && this.logStream) {
            this.logStream.write(formattedMessage + '\n');
        }
    }

    // Debug级别日志
    debug(message: string, meta?: any) {
        this.writeLog(LogLevel.DEBUG, 'DEBUG', message, meta);
    }

    // Info级别日志
    info(message: string, meta?: any) {
        this.writeLog(LogLevel.INFO, 'INFO', message, meta);
    }

    // Warn级别日志
    warn(message: string, meta?: any) {
        this.writeLog(LogLevel.WARN, 'WARN', message, meta);
    }

    // Error级别日志
    error(message: string, meta?: any) {
        this.writeLog(LogLevel.ERROR, 'ERROR', message, meta);
    }

    // 关闭日志流
    close() {
        if (this.logStream) {
            this.logStream.end();
        }
    }
}

// 创建全局默认日志实例
const defaultLogger = new Logger({
    level: process.env.LOG_LEVEL ? LogLevel[process.env.LOG_LEVEL as keyof typeof LogLevel] : LogLevel.INFO,
    filePath: process.env.LOG_FILE_PATH || path.join(process.cwd(), 'logs', 'app.log'),
    enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
    enableFile: process.env.LOG_ENABLE_FILE === 'true'
});

export default defaultLogger;
