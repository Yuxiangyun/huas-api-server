/**
 * 加密工具模块
 * 提供 RSA 加密和 Token 解析功能
 */
import { publicEncrypt, constants } from 'node:crypto';
import loggerInstance from './Logger';

export class CryptoHelper {
    /**
     * RSA 加密密码
     * @param password 明文密码
     * @param publicKey 公钥
     * @returns 加密后的密码，失败返回 null
     */
    static encryptPassword(password: string, publicKey: string): string | null {
        try {
            const buffer = Buffer.from(password);
            const encrypted = publicEncrypt({ 
                key: publicKey, 
                padding: constants.RSA_PKCS1_PADDING 
            }, buffer);
            return `__RSA__${encrypted.toString('base64')}`;
        } catch (e: any) {
            loggerInstance.error("RSA 加密失败", { error: e.message });
            return null;
        }
    }

    /**
     * 解析 URL 中的 JWT Token
     * @param urlStr 包含 ticket 参数的 URL
     * @returns 解析出的 idToken，失败返回 null
     */
    static extractTokenFromUrl(urlStr: string): string | null {
        try {
            const url = new URL(urlStr);
            const ticket = url.searchParams.get('ticket');
            if (!ticket) return null;

            const parts = ticket.split('.');
            if (parts.length !== 3) return null; 

            // URL-Safe Base64 处理
            let base64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
            const padding = base64.length % 4;
            if (padding > 0) base64 += '='.repeat(4 - padding);

            const payloadBuf = Buffer.from(base64, 'base64');
            const payload = JSON.parse(payloadBuf.toString('utf-8'));

            return payload.idToken || null;
        } catch (e: any) {
            loggerInstance.error("Token 解析失败", { error: e.message });
            return null;
        }
    }
}