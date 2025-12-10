// src/core/api/UserApi.ts
import { NetworkSession } from '../network/NetworkSession';
import { SessionExpiredError } from '../utils/errors';

const URLS = {
    // 注意域名是 authx-service
    userInfo: "https://authx-service.huas.edu.cn/personal/api/v1/personal/me/user"
};

export class UserApi {
    constructor(private session: NetworkSession) {}

    async getUserInfoRaw(token: string) {
        const res = await this.session.request(URLS.userInfo, {
            method: 'GET',
            headers: {
                'X-Id-Token': token,
                'X-Device-Info': 'PC',     // 必填
                'X-Terminal-Info': 'PC',   // 必填
                'Origin': 'https://portal.huas.edu.cn',
                'Referer': 'https://portal.huas.edu.cn/main.html'
            }
        });

        const text = await res.text();
        let json;
        try {
            json = JSON.parse(text);
        } catch {
            // 如果返回 HTML，通常是 404 或 跳转登录
            throw new SessionExpiredError("UserApi: Invalid JSON response");
        }

        // 检查业务 Code (0 表示成功)
        if (json.code !== 0) {
            // 比如 token 失效
            throw new SessionExpiredError(`UserApi Error: ${json.message || json.code}`);
        }

        return json;
    }
}