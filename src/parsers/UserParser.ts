/**
 * 用户信息解析器
 * 解析 Portal API 返回的用户信息
 * 实现 DataParser 接口，提供统一的解析方法
 */
import type { IUserInfo } from '../types';
import type { DataParser } from '../services/BaseService';

/** 用户信息原始数据类型 */
export type UserInfoRawData = any;

/**
 * 用户信息解析器实现
 */
class UserParserImpl implements DataParser<UserInfoRawData, IUserInfo> {
    /**
     * 解析用户信息 JSON
     * @param json Portal API 返回的 JSON 数据
     * @returns 解析后的用户信息，失败返回 null
     */
    parse(json: any): IUserInfo | null {
        if (!json || json.code !== 0 || !json.data) return null;

        const data = json.data;
        const attrs = data.attributes || {};

        return {
            // data.attributes.userName 是中文名
            name: attrs.userName || '未知姓名',
            // data.username 是学号
            studentId: data.username || '',
            // data.attributes.organizationName 是班级
            className: attrs.organizationName || '',
            identity: attrs.identityTypeName || '学生',
            organizationCode: attrs.organizationCode || ''
        };
    }
}

/** 导出单例 */
export const UserParser = new UserParserImpl();