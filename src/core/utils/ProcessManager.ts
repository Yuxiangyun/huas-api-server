/**
 * 进程管理模块
 * 处理优雅关闭、信号监听和资源清理
 */
import loggerInstance from './Logger';
import { scheduler } from '../Scheduler';
import { db } from '../../db';
import { SERVER_CONFIG } from '../../config';

export class ProcessManager {
    private isShuttingDown = false;
    private shutdownHandlers: Array<() => Promise<void>> = [];

    /**
     * 注册关闭处理器
     * @param handler 异步清理函数
     */
    registerShutdownHandler(handler: () => Promise<void>): void {
        this.shutdownHandlers.push(handler);
    }

    /**
     * 初始化进程管理
     */
    init(): void {
        // 监听进程终止信号
        process.on('SIGTERM', () => this.handleShutdown('SIGTERM'));
        process.on('SIGINT', () => this.handleShutdown('SIGINT'));
        
        // 监听未捕获异常
        process.on('uncaughtException', (error) => {
            console.error('='.repeat(80));
            console.error('未捕获的异常:');
            console.error('Message:', error.message);
            console.error('Stack:', error.stack);
            console.error('Error Object:', error);
            console.error('='.repeat(80));
            
            // 特殊错误处理：端口占用
            if ((error as any).code === 'EADDRINUSE') {
                console.error('\n❌ 端口已被占用！');
                console.error('解决方案：');
                console.error('1. 查看占用端口的进程: lsof -i :' + SERVER_CONFIG.PORT);
                console.error('2. 杀死占用进程: kill <PID>');
                console.error('3. 或使用其他端口: PORT=3001 bun run dev\n');
            }
            
            loggerInstance.error('未捕获的异常', { 
                message: error.message, 
                stack: error.stack,
                name: error.name,
                code: (error as any).code,
                errno: (error as any).errno,
                syscall: (error as any).syscall,
                error: String(error)
            });
            this.handleShutdown('uncaughtException');
        });
        
        // 监听未处理的 Promise 拒绝
        process.on('unhandledRejection', (reason, promise) => {
            loggerInstance.error('未处理的 Promise 拒绝', { reason, promise });
        });

        loggerInstance.info('进程管理器已初始化');
    }

    /**
     * 优雅关闭处理
     * @param signal 触发信号
     */
    private async handleShutdown(signal: string): Promise<void> {
        if (this.isShuttingDown) {
            loggerInstance.warn('已在关闭中，忽略重复信号', { signal });
            return;
        }

        this.isShuttingDown = true;
        loggerInstance.info('开始优雅关闭', { signal });

        try {
            // 1. 停止调度器
            scheduler.stop();
            loggerInstance.info('调度器已停止');

            // 2. 执行自定义关闭处理器
            for (const handler of this.shutdownHandlers) {
                try {
                    await handler();
                } catch (e: any) {
                    loggerInstance.error('关闭处理器执行失败', { error: e.message });
                }
            }

            // 3. 关闭数据库连接
            db.close();
            loggerInstance.info('数据库连接已关闭');

            // 4. 关闭日志流
            loggerInstance.close();

            // 5. 退出进程
            process.exit(0);
        } catch (e: any) {
            console.error('优雅关闭失败:', e);
            process.exit(1);
        }
    }

    /**
     * 获取关闭状态
     */
    isShutdown(): boolean {
        return this.isShuttingDown;
    }
}

// 导出单例
export const processManager = new ProcessManager();
