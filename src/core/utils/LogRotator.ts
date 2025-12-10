/**
 * 日志轮转工具
 * 自动归档和清理历史日志文件
 */
import fs from 'fs';
import path from 'path';
import loggerInstance from './Logger';

export interface LogRotateConfig {
    /** 日志文件路径 */
    filePath: string;
    /** 最大文件大小（字节，默认 10MB） */
    maxSize?: number;
    /** 保留的归档文件数量（默认 7 天） */
    maxFiles?: number;
    /** 检查间隔（毫秒，默认 1 小时） */
    checkInterval?: number;
}

export class LogRotator {
    private config: Required<LogRotateConfig>;
    private timer: Timer | null = null;

    constructor(config: LogRotateConfig) {
        this.config = {
            filePath: config.filePath,
            maxSize: config.maxSize || 10 * 1024 * 1024, // 10MB
            maxFiles: config.maxFiles || 7,
            checkInterval: config.checkInterval || 60 * 60 * 1000, // 1 hour
        };
    }

    /**
     * 启动日志轮转
     */
    start(): void {
        this.timer = setInterval(() => this.rotate(), this.config.checkInterval);
        loggerInstance.info('日志轮转器已启动', {
            maxSize: `${(this.config.maxSize / 1024 / 1024).toFixed(2)}MB`,
            maxFiles: this.config.maxFiles,
        });
    }

    /**
     * 停止日志轮转
     */
    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            loggerInstance.info('日志轮转器已停止');
        }
    }

    /**
     * 执行日志轮转
     */
    private rotate(): void {
        try {
            const { filePath, maxSize, maxFiles } = this.config;

            // 检查文件是否存在
            if (!fs.existsSync(filePath)) {
                return;
            }

            // 检查文件大小
            const stats = fs.statSync(filePath);
            if (stats.size < maxSize) {
                return;
            }

            // 归档当前日志
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            const ext = path.extname(filePath);
            const basename = path.basename(filePath, ext);
            const dirname = path.dirname(filePath);
            const archivePath = path.join(dirname, `${basename}-${timestamp}${ext}`);

            // 重命名当前日志
            fs.renameSync(filePath, archivePath);
            loggerInstance.info('日志文件已归档', { from: filePath, to: archivePath });

            // 清理旧日志
            this.cleanOldLogs(dirname, basename, ext, maxFiles);
        } catch (e: any) {
            loggerInstance.error('日志轮转失败', { error: e.message });
        }
    }

    /**
     * 清理旧日志文件
     */
    private cleanOldLogs(dirname: string, basename: string, ext: string, maxFiles: number): void {
        try {
            // 查找所有归档日志
            const files = fs.readdirSync(dirname);
            const pattern = new RegExp(`^${basename}-(\\d{4}-\\d{2}-\\d{2})${ext}$`);
            
            const archives = files
                .filter(file => pattern.test(file))
                .map(file => ({
                    name: file,
                    path: path.join(dirname, file),
                    time: fs.statSync(path.join(dirname, file)).mtime.getTime(),
                }))
                .sort((a, b) => b.time - a.time); // 按时间降序

            // 删除超过保留数量的文件
            const toDelete = archives.slice(maxFiles);
            for (const file of toDelete) {
                fs.unlinkSync(file.path);
                loggerInstance.info('旧日志文件已删除', { file: file.name });
            }
        } catch (e: any) {
            loggerInstance.error('清理旧日志失败', { error: e.message });
        }
    }
}
