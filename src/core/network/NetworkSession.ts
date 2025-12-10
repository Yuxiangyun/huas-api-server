/**
 * 网络会话管理模块
 * 管理 Cookie 和 HTTP 请求
 */
import { CookieJar } from 'tough-cookie';
import { SessionExpiredError } from '../utils/errors';
import loggerInstance from '../utils/Logger';

interface RequestOptions extends RequestInit {
    /** 是否为登录流程（允许跳转） */
    isAuthFlow?: boolean; 
}

export class NetworkSession {
    public jar: CookieJar;

    constructor(cookies?: any) {
        // 增强判断：只有当 cookies 是对象且包含 cookies 数组时才尝试反序列化
        const isValidStore = cookies && typeof cookies === 'object' && Array.isArray(cookies.cookies);
        this.jar = isValidStore ? CookieJar.fromJSON(cookies) : new CookieJar();
    }

    /**
     * 发起 HTTP 请求
     * @param url 请求 URL
     * @param options 请求选项
     */
    async request(url: string, options: RequestOptions = {}): Promise<Response> {
        const headers = new Headers({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36",
            ...options.headers
        });

        // 获取当前会话的 Cookie
        let cookieStr = "";
        try {
            cookieStr = this.jar.getCookieStringSync(url);
        } catch (e: any) {
            loggerInstance.warn("Cookie 获取失败", { error: e.message });
        }
        
        if (cookieStr) headers.set('Cookie', cookieStr);

        const res = await fetch(url, { ...options, headers, redirect: 'manual' });
        this._updateCookies(url, res.headers);

        // 非登录流程中检测会话过期
        if (!options.isAuthFlow) {
            if (res.status === 401 || res.status === 403) {
                throw new SessionExpiredError(`HTTP ${res.status}`);
            }
            if (res.status === 302) {
                const loc = res.headers.get('location') || "";
                if (loc.includes('cas/login')) {
                    throw new SessionExpiredError("重定向到登录页");
                }
            }
        }

        return res;
    }

    /**
     * 跟随重定向
     * @param url 起始 URL
     * @param maxRedirects 最大重定向次数
     */
    async followRedirects(url: string, maxRedirects = 5): Promise<Response> {
        let currentUrl = url;
        let res = await this.request(currentUrl, { isAuthFlow: true });
        let count = 0;
        
        while (count < maxRedirects && [301, 302, 303, 307].includes(res.status)) {
            const loc = res.headers.get('location');
            if (!loc) break;
            const nextUrl = new URL(loc, currentUrl).toString();
            res = await this.request(nextUrl, { method: 'GET', isAuthFlow: true });
            currentUrl = nextUrl;
            count++;
        }
        return res;
    }

    /**
     * 更新 Cookie Jar
     */
    private _updateCookies(url: string, headers: Headers) {
        let cookies: string[] = [];
        // @ts-ignore - getSetCookie 可能不存在于某些环境
        if (typeof headers.getSetCookie === 'function') {
            cookies = headers.getSetCookie();
        } else { 
            const raw = headers.get('set-cookie'); 
            if (raw) cookies = [raw]; 
        }
        
        cookies.forEach(c => { 
            try { 
                this.jar.setCookieSync(c, url); 
            } catch (e: any) {
                loggerInstance.debug("Cookie 设置失败", { cookie: c.substring(0, 20), error: e.message });
            }
        });
    }

    /**
     * 导出 Cookie 为 JSON
     */
    public exportCookies() {
        return this.jar.toJSON();
    }
}