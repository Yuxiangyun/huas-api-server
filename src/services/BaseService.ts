/**
 * 基础服务抽象类
 * 提供通用的数据获取、缓存、会话管理功能
 * 所有业务服务继承此类以复用通用逻辑
 */
import { SessionRepo } from '../db/SessionRepo';
import { CacheRepo } from '../db/CacheRepo';
import { SessionExpiredError } from '../core/utils/errors';
import { maskToken } from '../core/security';
import loggerInstance from '../core/utils/Logger';

/** 数据源标识 */
export type DataSource = 'cache' | 'network';

/** 数据获取选项 */
export interface FetchOptions {
    /** 是否强制刷新 */
    forceRefresh?: boolean;
    /** 缓存 TTL（秒） */
    ttl?: number;
    /** 数据类型标识 */
    type: string;
}

/** 数据获取结果 */
export interface FetchResult<T> {
    data: T;
    source: DataSource;
}

/** 数据解析器接口 */
export interface DataParser<TRaw, TData> {
    parse(raw: TRaw): TData | null;
}

/**
 * 基础服务抽象类
 * 提供数据获取、缓存管理、会话验证等通用功能
 */
export abstract class BaseService {
    protected token: string;
    protected sessionRepo: SessionRepo;
    protected cacheRepo: CacheRepo;
    
    constructor(token: string) {
        this.token = token;
        this.sessionRepo = new SessionRepo();
        this.cacheRepo = new CacheRepo();
    }
    
    /**
     * 获取当前用户标识
     * 子类需实现此方法
     */
    protected abstract getUserIdentifier(): string | undefined;
    
    /**
     * 验证会话有效性
     * @throws SessionExpiredError 会话无效或已过期
     */
    protected validateSession(): void {
        const session = this.sessionRepo.get(this.token);
        if (!session || !session.student_id) {
            loggerInstance.warn("会话不存在或未绑定用户", { token: maskToken(this.token) });
            throw new SessionExpiredError("请先登录");
        }
    }
    
    /**
     * 通用数据获取方法
     * 封装缓存检查、网络获取、错误处理逻辑
     * 
     * @param options 获取选项
     * @param fetcher 网络获取函数
     * @param parser 数据解析器
     * @returns 带数据源标识的结果
     */
    protected async fetchData<TRaw, TData>(
        options: FetchOptions,
        fetcher: () => Promise<TRaw>,
        parser: DataParser<TRaw, TData>
    ): Promise<FetchResult<TData>> {
        const { forceRefresh = false, ttl = 0, type } = options;
        const userId = this.getUserIdentifier();
        
        // 验证会话
        this.validateSession();
        
        if (!userId) {
            throw new SessionExpiredError("无法获取用户标识");
        }
        
        // 尝试读取缓存
        if (!forceRefresh && ttl > 0) {
            const cached = this.cacheRepo.get<TData>(userId, type, ttl);
            if (cached) {
                loggerInstance.debug("缓存命中", { type, userId: userId.substring(0, 8) });
                return { data: cached, source: 'cache' };
            }
        }
        
        // 从网络获取
        return await this.fetchFromNetwork(userId, type, fetcher, parser);
    }
    
    /**
     * 从网络获取数据
     * @param userId 用户标识
     * @param type 数据类型
     * @param fetcher 网络获取函数
     * @param parser 数据解析器
     */
    private async fetchFromNetwork<TRaw, TData>(
        userId: string,
        type: string,
        fetcher: () => Promise<TRaw>,
        parser: DataParser<TRaw, TData>
    ): Promise<FetchResult<TData>> {
        try {
            loggerInstance.info("从网络获取数据", { type, userId: userId.substring(0, 8) });
            
            const raw = await fetcher();
            const data = parser.parse(raw);
            
            if (!data) {
                throw new Error(`数据解析失败: ${type}`);
            }
            
            // 写入缓存
            this.cacheRepo.set(userId, type, data);
            
            return { data, source: 'network' };
        } catch (e: any) {
            if (e instanceof SessionExpiredError) {
                loggerInstance.warn("会话已过期", { token: maskToken(this.token), type });
                this.sessionRepo.delete(this.token);
                throw e;
            }
            
            loggerInstance.error("数据获取失败", { 
                type, 
                error: e.message,
                userId: userId.substring(0, 8)
            });
            throw e;
        }
    }
    
    /**
     * 使缓存失效
     * @param type 数据类型（可选，不传则清除所有缓存）
     */
    protected invalidateCache(type?: string): void {
        const userId = this.getUserIdentifier();
        if (!userId) return;
        
        if (type) {
            this.cacheRepo.delete(userId, type);
            loggerInstance.info("缓存失效", { type, userId: userId.substring(0, 8) });
        } else {
            this.cacheRepo.delete(userId);
            loggerInstance.info("清除所有缓存", { userId: userId.substring(0, 8) });
        }
    }
}
