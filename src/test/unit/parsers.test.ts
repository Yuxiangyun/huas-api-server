/**
 * 单元测试 - 数据解析器
 * 测试所有 Parser 的解析逻辑
 */
import { describe, test, expect } from 'bun:test';
import { ScheduleParser } from '../../parsers/ScheduleParser';
import { UserParser } from '../../parsers/UserParser';
import { ECardParser } from '../../parsers/ECardParser';
import { 
    MOCK_SCHEDULE_HTML, 
    MOCK_SESSION_EXPIRED_HTML,
    MOCK_USER_INFO_JSON,
    MOCK_ECARD_JSON,
    MOCK_ECARD_ERROR_JSON
} from '../helpers/MockData';

describe('Parser 单元测试', () => {
    
    describe('ScheduleParser', () => {
        test('应该正确解析有效的课程表 HTML', () => {
            const result = ScheduleParser.parse(MOCK_SCHEDULE_HTML);
            
            expect(result).not.toBeNull();
            expect(result?.week).toBe('第15周');
            expect(result?.courses).toBeArrayOfSize(2);
            
            const firstCourse = result?.courses[0];
            expect(firstCourse?.name).toBe('高等数学');
            expect(firstCourse?.location).toBe('教学楼A101');
            expect(firstCourse?.teacher).toBe('张三');
            expect(firstCourse?.day).toBe(2);
        });
        
        test('应该检测到会话过期并抛出错误', () => {
            expect(() => {
                ScheduleParser.parse(MOCK_SESSION_EXPIRED_HTML);
            }).toThrow('SESSION_EXPIRED');
        });
        
        test('应该正确解析空课程表', () => {
            const emptyHtml = `
                <html><body>
                <script>var li_showWeek = '第1周';</script>
                <table class="kb_table"><tbody><tr><td>第1节</td></tr></tbody></table>
                </body></html>
            `;
            
            const result = ScheduleParser.parse(emptyHtml);
            expect(result?.week).toBe('第1周');
            expect(result?.courses).toBeArrayOfSize(0);
        });
        
        test('应该处理不同的周次格式', () => {
            const html = `
                <html><body>
                <script>li_showWeek='2024-2025学年第一学期第10周';</script>
                <table class="kb_table"><tbody></tbody></table>
                </body></html>
            `;
            
            const result = ScheduleParser.parse(html);
            expect(result?.week).toContain('第10周');
        });
    });
    
    describe('UserParser', () => {
        test('应该正确解析有效的用户信息 JSON', () => {
            const result = UserParser.parse(MOCK_USER_INFO_JSON);
            
            expect(result).not.toBeNull();
            expect(result?.name).toBe('张三');
            expect(result?.studentId).toBe('202401001');
            expect(result?.className).toBe('计算机科学与技术2024-1班');
            expect(result?.identity).toBe('学生');
        });
        
        test('应该处理缺失字段的情况', () => {
            const incompleteJson = {
                code: 0,
                data: {
                    username: '202401002',
                    attributes: {}
                }
            };
            
            const result = UserParser.parse(incompleteJson);
            expect(result).not.toBeNull();
            expect(result?.name).toBe('未知姓名');
            expect(result?.studentId).toBe('202401002');
            expect(result?.className).toBe('');
        });
        
        test('应该拒绝无效的响应码', () => {
            const invalidJson = { code: 500, data: null };
            const result = UserParser.parse(invalidJson);
            expect(result).toBeNull();
        });
        
        test('应该处理 null 输入', () => {
            const result = UserParser.parse(null);
            expect(result).toBeNull();
        });
    });
    
    describe('ECardParser', () => {
        test('应该正确解析有效的一卡通 JSON', () => {
            const result = ECardParser.parse(MOCK_ECARD_JSON);
            
            expect(result).not.toBeNull();
            expect(result?.balance).toBe(125.50);
            expect(result?.status).toBe('正常');
            expect(result?.lastTime).toBe('2025-12-10 10:30:00');
        });
        
        test('应该兼容字符串和数字类型的 code', () => {
            const stringCode = { ...MOCK_ECARD_JSON, code: '0' };
            const numberCode = { ...MOCK_ECARD_JSON, code: 0 };
            
            expect(ECardParser.parse(stringCode)).not.toBeNull();
            expect(ECardParser.parse(numberCode)).not.toBeNull();
        });
        
        test('应该处理错误响应', () => {
            const result = ECardParser.parse(MOCK_ECARD_ERROR_JSON);
            expect(result).toBeNull();
        });
        
        test('应该容错处理不同的字段名', () => {
            const alternativeFields = {
                code: 0,
                data: {
                    wallet: '88.88',  // 使用 wallet 而不是 cardWallet
                    status: '挂失',
                    time: '2025-12-10'
                }
            };
            
            const result = ECardParser.parse(alternativeFields);
            expect(result).not.toBeNull();
            expect(result?.balance).toBe(88.88);
            expect(result?.status).toBe('挂失');
        });
        
        test('应该处理余额为 0 的情况', () => {
            const zeroBalance = {
                code: 0,
                data: { cardWallet: '0' }
            };
            
            const result = ECardParser.parse(zeroBalance);
            expect(result?.balance).toBe(0);
        });
    });
});
