// src/types.ts

// 数据库：会话表结构
export interface DbSession {
    token: string;          // UUID (主键)
    student_id: string | null; // 绑定的学号 (未登录时为 null)
    cookies: any;           // CookieJar JSON
    portal_token: string | null;
    execution: string | null;
    user_agent: string | null; // 预留：记录设备信息
    created_at: number;
    updated_at: number;
}

// 用户会话状态（用于序列化/反序列化）
export interface UserSession {
    id: string;
    cookies: any;
    portalToken?: string;
    execution?: string;
    updatedAt: number;
}

// 数据库：缓存表结构
export interface DbCache {
    student_id: string;
    type: 'SCHEDULE' | 'ECARD' | 'USER_INFO';
    data: string;           // JSON 字符串
    updated_at: number;
}

// 业务实体：课程
export interface ICourse {
    name: string;
    teacher: string;
    location: string;
    day: number;
    section: string;
    weekStr?: string;
}

// 业务实体：一卡通
export interface IECard {
    balance: number;
    status: string;
    lastTime: string;
}

// 业务实体：用户信息
export interface IUserInfo {
    name: string;
    studentId: string;
    className: string;
    identity: string;
    organizationCode: string;
}