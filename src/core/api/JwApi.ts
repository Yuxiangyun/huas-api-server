/**
 * 教务系统 API 模块
 * 提供课程表等教务数据获取功能
 */
import { NetworkSession } from '../network/NetworkSession';
import { SessionExpiredError } from '../utils/errors';
import { JW_CONFIG } from '../../config';

/** 教务系统 API 地址 */
const URLS = {
    kbApi: "https://xyjw.huas.edu.cn/jsxsd/framework/main_index_loadkb.jsp"
};

export class JwApi {
    constructor(private session: NetworkSession) {}

    /**
     * 获取课程表原始 HTML
     * @returns 课程表 HTML 内容
     */
    async getScheduleRaw(): Promise<string> {
        const date = new Date().toISOString().split('T')[0] || ''; 
        const params = new URLSearchParams();
        params.append('rq', date);
        params.append('sjmsValue', JW_CONFIG.SJMS_VALUE);

        const res = await this.session.request(URLS.kbApi, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Referer': 'https://xyjw.huas.edu.cn/jsxsd/framework/xsMain_new.jsp?t1=1'
            },
            body: params
        });

        const text = await res.text();
        
        // 双重检查：HTML 内容是否包含登录表单
        if (text.includes('id="username"') || text.includes('用户登录')) {
            throw new SessionExpiredError("课程表响应包含登录表单");
        }

        return text;
    }
}