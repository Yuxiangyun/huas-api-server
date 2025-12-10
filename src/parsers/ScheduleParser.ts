/**
 * 课程表解析器
 * 解析教务系统 HTML 课程表数据
 * 实现 DataParser 接口，提供统一的解析方法
 */
import * as cheerio from 'cheerio';
import type { ICourse } from '../types';
import type { DataParser } from '../services/BaseService';
import loggerInstance from '../core/utils/Logger';

/** 课程表原始数据类型 */
export type ScheduleRawData = string;

/** 课程表解析结果 */
export interface ScheduleData {
    week: string;
    courses: ICourse[];
}

/**
 * 课程表解析器实现
 */
class ScheduleParserImpl implements DataParser<ScheduleRawData, ScheduleData> {
    /**
     * 解析课程表 HTML
     * @param html 教务系统返回的 HTML
     * @returns 周次和课程列表
     */
    parse(html: string): ScheduleData | null {
        // 检查常见会话失效关键字
        if (html.includes('用户登录') || html.includes('name="username"') || html.includes('top.location.href')) {
            throw new Error("SESSION_EXPIRED");
        }

        const $ = cheerio.load(html);
        let week = "未知";
        
        // 提取周次信息
        $('script').each((_, el) => {
            const txt = $(el).html() || '';
            const m = txt.match(/li_showWeek.*?>(.*?)<|li_showWeek.*?'(.*?)'/);
            if (m) week = m[1] || m[2] || week;
        });

        const courses: ICourse[] = [];
        const fieldMap: Record<string, string> = { 
            "课程名称": "name", 
            "上课地点": "location", 
            "教师": "teacher", 
            "上课时间": "weekStr" 
        };

        const rows = $('table.kb_table tbody tr');
        
        // 警告：未找到表格行
        if (rows.length === 0) {
            loggerInstance.warn("课程表解析警告：未找到表格行");
        }

        // 解析每一行
        rows.each((_, row) => {
            const cells = $(row).find('td');
            if (!cells.length) return;
            const section = $(cells[0]).text().trim().split(' ')[0];

            for (let day = 1; day <= 7; day++) {
                $(cells[day]).find('div.kb_content, p[title]').each((_, item) => {
                    const title = $(item).attr('title');
                    if (!title) return;
                    
                    const course: any = { day, section };
                    title.split(/<br\s*\/?>|\n/i).forEach(part => {
                        const idx = part.indexOf('：');
                        if (idx > -1) {
                            const k = part.substring(0, idx).trim();
                            const v = part.substring(idx + 1).trim();
                            if (fieldMap[k]) course[fieldMap[k]] = v;
                        }
                    });
                    if (course.name) courses.push(course);
                });
            }
        });

        loggerInstance.debug("课程表解析完成", { week, count: courses.length });
        return { week, courses };
    }
}

/** 导出单例 */
export const ScheduleParser = new ScheduleParserImpl();