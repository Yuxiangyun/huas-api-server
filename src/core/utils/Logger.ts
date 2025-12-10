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

// 默认配置
const DEFAULT_CONFIG: LoggerConfig = {
    level: LogLevel.INFO,
    enableConsole: true,
    enableFile: true
};

export class Logger {
    private config: LoggerConfig;
    private logStream: fs.WriteStream | null = null;

    constructor(config?: Partial<LoggerConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        
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
        const logEntry: LogEntry = {
            timestamp,
            level,
            message,
            meta
        };
        
        return JSON.stringify(logEntry);
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
    enableFile: process.env.LOG_ENABLE_FILE !== 'false'
});

export default defaultLogger;