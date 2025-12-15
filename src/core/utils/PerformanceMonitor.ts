/**
 * 性能监控模块
 * 收集和报告系统性能指标（扩展了主机/进程信息）
 */
import os from 'os';
import loggerInstance from './Logger';

/** 性能指标接口 */
export interface PerformanceMetrics {
    totalRequests: number;
    successRequests: number;
    errorRequests: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    reqPerSec: number;
    reqPerMin: number;
    reqPer5Min: number;
    memoryUsage: {
        rss: number;
        heapUsed: number;
        heapTotal: number;
    };
    cpuUsage: {
        user: number;
        system: number;
        percent: number;
    };
    uptime: number;
    timestamp: string;
    host: {
        hostname: string;
        platform: string;
        arch: string;
        load1: number;
        load5: number;
        load15: number;
        totalMemMB: number;
        freeMemMB: number;
    };
    processInfo: {
        pid: number;
        nodeVersion: string;
        bunVersion: string;
        env: string;
        startedAt: string;
    };
}

export class PerformanceMonitor {
    private startTime = Date.now();
    private metrics = {
        totalRequests: 0,
        successRequests: 0,
        errorRequests: 0,
        responseTimes: [] as number[],
        timeline: [] as number[],
    };
    private responseWindow = 5000; // 最多保留多少条响应时间
    private timelineWindowMs = 5 * 60 * 1000; // 请求时间轴保留 5 分钟

    /**
     * 记录请求
     */
    recordRequest(duration: number, success: boolean = true): void {
        this.metrics.totalRequests++;
        if (success) {
            this.metrics.successRequests++;
        } else {
            this.metrics.errorRequests++;
        }
        this.metrics.responseTimes.push(duration);
        if (this.metrics.responseTimes.length > this.responseWindow) {
            this.metrics.responseTimes.shift();
        }
        const now = Date.now();
        this.metrics.timeline.push(now);
        while (this.metrics.timeline.length > 0 && this.metrics.timeline[0] < now - this.timelineWindowMs) {
            this.metrics.timeline.shift();
        }
    }

    /**
     * 获取当前性能指标
     */
    getMetrics(): PerformanceMetrics {
        const mem = process.memoryUsage();
        const cpu = process.cpuUsage();
        const uptimeSeconds = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));
        const load = os.loadavg();

        const avgResponseTime = this.metrics.responseTimes.length > 0
            ? this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length
            : 0;

        const percentile = (arr: number[], p: number) => {
            if (!arr.length) return 0;
            const sorted = [...arr].sort((a, b) => a - b);
            const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
            return sorted[idx];
        };
        const p95 = percentile(this.metrics.responseTimes, 95);
        const p99 = percentile(this.metrics.responseTimes, 99);

        const now = Date.now();
        const recent1m = this.metrics.timeline.filter(t => t >= now - 60_000).length;
        const recent5m = this.metrics.timeline.filter(t => t >= now - 300_000).length;
        const reqPerSec = recent1m / 60;

        // CPU 占用率估算：总 CPU 时间 / (uptime * CPU 核数)
        const cpuTotalMs = (cpu.user + cpu.system) / 1000;
        const cpuPercent = (() => {
            const cores = Math.max(1, os.cpus()?.length || 1);
            return Math.min(100, Math.round(((cpuTotalMs / 1000) / (uptimeSeconds * cores)) * 100 * 10) / 10);
        })();

        return {
            totalRequests: this.metrics.totalRequests,
            successRequests: this.metrics.successRequests,
            errorRequests: this.metrics.errorRequests,
            avgResponseTime: Math.round(avgResponseTime * 100) / 100,
            p95ResponseTime: Math.round(p95 * 100) / 100,
            p99ResponseTime: Math.round(p99 * 100) / 100,
            reqPerSec: Math.round(reqPerSec * 100) / 100,
            reqPerMin: recent1m,
            reqPer5Min: recent5m,
            memoryUsage: {
                rss: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
                heapUsed: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
                heapTotal: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
            },
            cpuUsage: {
                user: Math.round(cpu.user / 1000),
                system: Math.round(cpu.system / 1000),
                percent: cpuPercent,
            },
            uptime: uptimeSeconds,
            timestamp: new Date().toISOString(),
            host: {
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                load1: Math.round(load[0] * 100) / 100,
                load5: Math.round(load[1] * 100) / 100,
                load15: Math.round(load[2] * 100) / 100,
                totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
                freeMemMB: Math.round(os.freemem() / 1024 / 1024),
            },
            processInfo: {
                pid: process.pid,
                nodeVersion: process.version,
                bunVersion: (globalThis as any)?.Bun?.version || 'unknown',
                env: process.env.NODE_ENV || 'development',
                startedAt: new Date(this.startTime).toISOString(),
            },
        };
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
            timeline: [],
        };
        loggerInstance.info('性能指标已重置');
    }
}

// 导出单例
export const performanceMonitor = new PerformanceMonitor();
