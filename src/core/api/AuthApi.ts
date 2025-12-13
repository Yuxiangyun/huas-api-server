import * as cheerio from 'cheerio';
import { NetworkSession } from '../network/NetworkSession';
import { CryptoHelper } from '../utils/CryptoHelper';
import loggerInstance from '../utils/Logger';

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
        // 首次尝试明确告知失败次数为 0，避免默认 -1 触发验证码
        params.append('failN', '0');
        // 只有用户真实输入了验证码才带上
        if (captcha && captcha.trim()) {
            params.append('captcha', captcha.trim());
        }

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
        const text = await res.text();
        // 只有出现明确的“验证码不能为空/错误/失效/不正确”提示才认为需要验证码
        let needCaptcha = /验证码(不能为空|错误|失效|不正确)/i.test(text) || /captcha\s+(error|invalid|required)/i.test(text.toLowerCase());
        // 如果本次已提交验证码但仍命中上述提示，则视为普通失败，避免前端死循环要求验证码
        if (needCaptcha && captcha && captcha.trim()) {
            needCaptcha = false;
        }
        const snippet = text.slice(0, 200);
        if (needCaptcha) {
            loggerInstance.warn("CAS返回提示需要验证码", { snippet });
        } else {
            loggerInstance.debug("CAS登录失败但未命中验证码提示", { status: res.status, snippet });
        }
        return { success: false, needCaptcha };
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
