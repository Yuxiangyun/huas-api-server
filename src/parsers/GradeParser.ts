/**
 * 成绩列表解析器
 * 解析教务系统返回的成绩 HTML，并输出清洗后的结构化数据
 */
import * as cheerio from 'cheerio';
import type { DataParser } from '../services/BaseService';
import type { IGradeItem, IGradeList, IGradeSummary } from '../types';
import loggerInstance from '../core/utils/Logger';
import { SessionExpiredError } from '../core/utils/errors';

/** 成绩原始数据类型 */
export type GradeRawData = string;

/**
 * 成绩解析器实现
 */
class GradeParserImpl implements DataParser<GradeRawData, IGradeList> {
    parse(html: string): IGradeList | null {
        if (!html || typeof html !== 'string') return null;

        // 二次校验：如果返回了登录页，视为会话过期
        if (this.containsLoginForm(html)) {
            throw new Error("SESSION_EXPIRED");
        }

        const $ = cheerio.load(html);
        const items: IGradeItem[] = [];

        const normalize = (val: string) => val.replace(/\s+/g, ' ').trim();
        const toNumber = (val: string) => {
            const num = parseFloat(val);
            return Number.isFinite(num) ? num : null;
        };

        $('#dataList tr').slice(1).each((_, row) => {
            const cells = $(row).find('td');
            if (cells.length < 10) return;

            const text = (idx: number) => normalize($(cells[idx]).text());
            const scoreText = text(5);
            const score = toNumber(scoreText);

            const item: IGradeItem = {
                term: text(1),
                courseCode: text(2),
                courseName: text(3),
                groupName: text(4),
                score,
                scoreText,
                pass: this.detectPass(score, scoreText),
                flag: text(6),
                credit: toNumber(text(7)),
                totalHours: toNumber(text(8)),
                gpa: toNumber(text(9)),
                retakeTerm: text(10),
                examMethod: text(11),
                examNature: text(12),
                courseAttribute: text(13),
                courseNature: text(14),
                courseCategory: text(15)
            };

            // 跳过空白行
            if (item.courseCode || item.courseName) {
                items.push(item);
            }
        });

        const summary = this.extractSummary($);

        // 如果完全解析不到数据，视为会话失效或接口异常，触发重登
        if (items.length === 0 && !summary.totalCourses && !summary.totalCredits) {
            loggerInstance.warn("成绩解析结果为空，可能会话失效");
            throw new SessionExpiredError("GRADE_EMPTY");
        }

        loggerInstance.debug("成绩解析完成", { count: items.length, summary });
        return { summary, items };
    }

    /**
     * 检测响应中是否含登录页标识
     */
    private containsLoginForm(html: string): boolean {
        return html.includes('用户登录') || html.includes('name="username"') || html.includes('top.location.href');
    }

    /**
     * 根据分数/文字判断通过情况
     */
    private detectPass(score: number | null, text: string): boolean | null {
        if (score !== null) return score >= 60;
        if (!text) return null;

        const passKeywords = ['及格', '合格', '中', '良', '优', '通过'];
        const failKeywords = ['不及格', '未通过', '不通过', '重修', '挂'];

        if (passKeywords.some(k => text.includes(k))) return true;
        if (failKeywords.some(k => text.includes(k))) return false;
        return null;
    }

    /**
     * 提取页面顶部的统计摘要
     */
    private extractSummary($: cheerio.CheerioAPI): IGradeSummary {
        const text = $('body').text().replace(/\s+/g, ' ');
        const match = text.match(/所修门数[:：]\s*([\d.]+).*?所修总学分[:：]\s*([\d.]+).*?平均学分绩点[:：]\s*([\d.]+).*?平均成绩[:：]\s*([\d.]+)/);

        const toNumber = (val: string | undefined) => {
            if (!val) return null;
            const num = parseFloat(val);
            return Number.isFinite(num) ? num : null;
        };

        return {
            totalCourses: toNumber(match?.[1]),
            totalCredits: toNumber(match?.[2]),
            averageGpa: toNumber(match?.[3]),
            averageScore: toNumber(match?.[4])
        };
    }
}

/** 导出单例 */
export const GradeParser = new GradeParserImpl();
