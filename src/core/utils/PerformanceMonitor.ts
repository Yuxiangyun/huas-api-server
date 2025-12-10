/**
 * 性能监控模块
 * 收集和报告系统性能指标
 */
import loggerInstance from './Logger';

/** 性能指标接口 */
export interface PerformanceMetrics {
    /** 请求总数 */
    totalRequests: number;
    /** 成功请求数 */
    successRequests: number;
    /** 失败请求数 */
    errorRequests: number;
    /** 平均响应时间（毫秒） */
    avgResponseTime: number;
    /** 内存使用（MB） */
    memoryUsage: {
        rss: number;
        heapUsed: number;
        heapTotal: number;
    };
    /** CPU 使用率 */
    cpuUsage: {
        user: number;
        system: number;
    };
    /** 运行时长（秒） */
    uptime: number;
}

export class PerformanceMonitor {
    private startTime = Date.now();
    private metrics = {
        totalRequests: 0,
        successRequests: 0,
        errorRequests: 0,
        responseTimes: [] as number[],
    };
    private timer: Timer | null = null;

    /**
     * 记录请求
     * @param duration 响应时间（毫秒）
     * @param success 是否成功
     */
    recordRequest(duration: number, success: boolean = true): void {
        this.metrics.totalRequests++;
        if (success) {
            this.metrics.successRequests++;
        } else {
            this.metrics.errorRequests++;
        }
        
        // 保留最近 1000 个请求的响应时间
        this.metrics.responseTimes.push(duration);
        if (this.metrics.responseTimes.length > 1000) {
            this.metrics.responseTimes.shift();
        }
    }

    /**
     * 获取当前性能指标
     */
    getMetrics(): PerformanceMetrics {
        const mem = process.memoryUsage();
        const cpu = process.cpuUsage();
        
        // 计算平均响应时间
        const avgResponseTime = this.metrics.responseTimes.length > 0
            ? this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length
            : 0;

        return {
            totalRequests: this.metrics.totalRequests,
            successRequests: this.metrics.successRequests,
            errorRequests: this.metrics.errorRequests,
            avgResponseTime: Math.round(avgResponseTime * 100) / 100,
            memoryUsage: {
                rss: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
                heapUsed: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
                heapTotal: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
            },
            cpuUsage: {
                user: Math.round(cpu.user / 1000),
                system: Math.round(cpu.system / 1000),
            },
            uptime: Math.round((Date.now() - this.startTime) / 1000),
        };
    }

    /**
     * 启动定期报告
     * @param interval 报告间隔（毫秒，默认 5 分钟）
     */
    startReporting(interval: number = 5 * 60 * 1000): void {
        this.timer = setInterval(() => {
            const metrics = this.getMetrics();
            loggerInstance.info('性能指标报告', metrics);
        }, interval);
        
        loggerInstance.info('性能监控已启动', { interval: `${interval / 1000}秒` });
    }

    /**
     * 停止定期报告
     */
    stopReporting(): void {
        if (this.timer) {
            clearInterval(this.timer);
            loggerInstance.info('性能监控已停止');
        }
    }

    /**
     * 重置指标
     */
    reset(): void {
        this.startTime = Date.now();
        this.metrics = {
            totalRequests: 0,
            successRequests: 0,
            errorRequests: 0,
            responseTimes: [],
        };
        loggerInstance.info('性能指标已重置');
    }
}

// 导出单例
export const performanceMonitor = new PerformanceMonitor();
