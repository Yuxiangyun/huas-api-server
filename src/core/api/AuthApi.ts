import * as cheerio from 'cheerio';
import { NetworkSession } from '../network/NetworkSession';
import { CryptoHelper } from '../utils/CryptoHelper';

const URLS = {
    login: "https://cas.huas.edu.cn/cas/login",
    captcha: "https://cas.huas.edu.cn/cas/captcha.jpg",
    pubkey: "https://cas.huas.edu.cn/cas/jwt/publicKey",
    servicePortal: "https://portal.huas.edu.cn/login", 
    serviceJw: "https://xyjw.huas.edu.cn/sso.jsp?targetUrl=base64aHR0cHM6Ly94eWp3Lmh1YXMuZWR1LmNuL2luZGV4LmpzcA=="
};

export class AuthApi {
    constructor(private session: NetworkSession) {}

    async getExecution(): Promise<string | null> {
        const url = `${URLS.login}?service=${encodeURIComponent(URLS.servicePortal)}`;
        // 登录流程，允许跳转
        const res = await this.session.request(url, { isAuthFlow: true });
        const html = await res.text();
        const $ = cheerio.load(html);
        return $('input[name="execution"]').val() as string || null;
    }

    async getCaptcha(): Promise<ArrayBuffer> {
        const res = await this.session.request(`${URLS.captcha}?r=${Date.now()}`, { isAuthFlow: true });
        return await res.arrayBuffer();
    }

    async login(username: string, password: string, captcha: string, execution: string) {
        const resKey = await this.session.request(URLS.pubkey, { isAuthFlow: true });
        const pubKey = await resKey.text();
        const encryptedPw = CryptoHelper.encryptPassword(password, pubKey);
        
        if (!encryptedPw) return { success: false };

        const params = new URLSearchParams();
        params.append('username', username);
        params.append('password', encryptedPw);
        params.append('currentMenu', '1');
        params.append('execution', execution);
        params.append('_eventId', 'submit');
        params.append('submit1', 'Login1');
        params.append('captcha', captcha);

        const loginUrl = `${URLS.login}?service=${encodeURIComponent(URLS.servicePortal)}`;
        const res = await this.session.request(loginUrl, { 
            method: 'POST', 
            body: params,
            isAuthFlow: true 
        });

        if (res.status === 302) {
            const loc = res.headers.get('location');
            if (loc && loc.includes('ticket=')) {
                return { success: true, redirectUrl: loc };
            }
        }
        return { success: false };
    }

    async activateJwSession() {
        const url = `${URLS.login}?service=${encodeURIComponent(URLS.serviceJw)}`;
        const res = await this.session.request(url, { isAuthFlow: true });
        if (res.status === 302) {
            const loc = res.headers.get('location');
            if (loc) await this.session.followRedirects(loc);
        }
    }
}