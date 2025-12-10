/**
 * 一卡通数据解析器
 * 解析 Portal API 返回的一卡通数据
 * 实现 DataParser 接口，提供统一的解析方法
 */
import type { IECard } from '../types';
import type { DataParser } from '../services/BaseService';
import loggerInstance from '../core/utils/Logger';

/** 一卡通原始数据类型 */
export type ECardRawData = any;

/**
 * 一卡通解析器实现
 */
class ECardParserImpl implements DataParser<ECardRawData, IECard> {
    /**
     * 解析一卡通 API 响应
     * @param json API 返回的 JSON 数据
     * @returns 解析后的一卡通信息，失败返回 null
     */
    parse(json: any): IECard | null {
        if (!json) return null;

        // 检查业务错误码 (兼容字符串 '0' 和数字 0)
        if (json.code !== '0' && json.code !== 0) {
            loggerInstance.warn("一卡通 API 返回错误", { code: json.code, msg: json.msg || json.message });
            if (!json.data) return null;
        }

        const data = json.data || {};

        // 容错处理：尝试读取不同的字段名
        const balanceStr = data.cardWallet || data.wallet || data.balance || data.card_wallet || '0';
        
        return {
            balance: parseFloat(balanceStr.toString()), 
            status: data.cardStatus || data.status || '未知',
            lastTime: data.dbTime || data.time || ''
        };
    }
}

/** 导出单例 */
export const ECardParser = new ECardParserImpl();