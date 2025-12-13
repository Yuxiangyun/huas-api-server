// 引用路径：上两级到 src，再到 types
import type { UserSession } from '../types'; 
import { NetworkSession } from './network/NetworkSession';
import { CryptoHelper } from './utils/CryptoHelper';
import { AuthApi } from './api/AuthApi';
import { PortalApi } from './api/PortalApi';
import { JwApi } from './api/JwApi';
import { UserApi } from './api/UserApi';
import loggerInstance from './utils/Logger';

export class HuasClient {
    public userId: string;
    public portalToken: string | null = null;
    public execution: string | null = null;
    
    // 模块组合
    public session: NetworkSession;
    private authApi: AuthApi;
    private portalApi: PortalApi;
    private jwApi: JwApi;
    private userApi: UserApi;

    constructor(id: string, savedSession?: UserSession) {
        this.userId = id;
        
        // 恢复 Session
        this.session = new NetworkSession(savedSession?.cookies);
        this.portalToken = savedSession?.portalToken || null;
        this.execution = savedSession?.execution || null;

        // 初始化子模块
        this.authApi = new AuthApi(this.session);
        this.portalApi = new PortalApi(this.session);
        this.jwApi = new JwApi(this.session);
        this.userApi = new UserApi(this.session);
    }

    public exportState(): UserSession {
        return {
            id: this.userId,
            cookies: this.session.exportCookies(),
            portalToken: this.portalToken || undefined,
            execution: this.execution || undefined,
            updatedAt: Date.now()
        };
    }

    // === 登录流程 ===

    async prepareLogin() {
        this.execution = await this.authApi.getExecution();
    }

    async getCaptcha() {
        return await this.authApi.getCaptcha();
    }

    async login(username: string, password: string, captcha: string): Promise<{ success: boolean; needCaptcha?: boolean; message?: string; }> {
        if (!this.execution) return { success: false, needCaptcha: true, message: 'execution_missing' };

        const result = await this.authApi.login(username, password, captcha, this.execution);
        
        if (result.success && result.redirectUrl) {
            loggerInstance.info("CAS 验证通过");

            // 1. 解析 Token
            this.portalToken = CryptoHelper.extractTokenFromUrl(result.redirectUrl);
            
            // 2. 激活 Portal Session (让 Jar 记录 cookie)
            await this.session.followRedirects(result.redirectUrl);

            // 3. 激活教务 Session
            await this.authApi.activateJwSession();

            return { success: true };
        }
        if (result.needCaptcha) {
            loggerInstance.warn("CAS 登录失败，需要验证码", { userId: this.userId });
        }
        return { success: false, needCaptcha: result.needCaptcha };
    }

    // === 数据获取 ===

    async fetchECardRaw() {
        if (!this.portalToken) return { code: -1, msg: "Token Missing" };
        return await this.portalApi.getECardRaw(this.portalToken);
    }

    async fetchScheduleRaw() {
        return await this.jwApi.getScheduleRaw();
    }
    
    async fetchGradesRaw() {
        return await this.jwApi.getGradesRaw();
    }
    
    async fetchUserInfoRaw() {
        if (!this.portalToken) throw new Error("Token Missing");
        return await this.userApi.getUserInfoRaw(this.portalToken);
    }
}
