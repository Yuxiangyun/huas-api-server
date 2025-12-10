import { NetworkSession } from '../network/NetworkSession';
import { SessionExpiredError } from '../utils/errors';

const URLS = {
    ecardApi: "https://portal.huas.edu.cn/portalApi/v2/personalData/getMyECard"
};

export class PortalApi {
    constructor(private session: NetworkSession) {}

    async getECardRaw(token: string) {
        const res = await this.session.request(URLS.ecardApi, {
            headers: {
                'X-Id-Token': token,
                'Referer': 'https://portal.huas.edu.cn/main.html'
            }
        });

        const text = await res.text();
        let json;
        try {
            json = JSON.parse(text);
        } catch {
            // 返回了 HTML 而不是 JSON，说明 Session 可能失效或服务错误
            throw new SessionExpiredError("Invalid JSON response (Possible HTML login page)");
        }

        // 检查业务 Code
        if (json.code === '401' || json.code === 401 || json.code === '403') {
            throw new SessionExpiredError(`API Error Code: ${json.code}`);
        }

        return json;
    }
}