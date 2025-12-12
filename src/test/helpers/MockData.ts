/**
 * 测试 Mock 数据
 * 提供各种测试场景所需的模拟数据
 */

/** Mock HTML - 课程表页面 */
export const MOCK_SCHEDULE_HTML = `
<!DOCTYPE html>
<html>
<head><title>课程表</title></head>
<body>
<script>
var li_showWeek = '第15周';
</script>
<table class="kb_table">
<tbody>
<tr>
    <td>第1节</td>
    <td></td>
    <td>
        <div class="kb_content">
            <p title="课程名称：高等数学<br/>上课地点：教学楼A101<br/>教师：张三<br/>上课时间：1-16周"></p>
        </div>
    </td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
</tr>
<tr>
    <td>第3节</td>
    <td></td>
    <td></td>
    <td>
        <div class="kb_content">
            <p title="课程名称：大学英语<br/>上课地点：教学楼B203<br/>教师：李四<br/>上课时间：1-16周"></p>
        </div>
    </td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
</tr>
</tbody>
</table>
</body>
</html>
`;

/** Mock HTML - 会话过期页面 */
export const MOCK_SESSION_EXPIRED_HTML = `
<!DOCTYPE html>
<html>
<head><title>用户登录</title></head>
<body>
<form>
    <input type="text" name="username" />
    <input type="password" name="password" />
</form>
</body>
</html>
`;

/** Mock JSON - 用户信息 */
export const MOCK_USER_INFO_JSON = {
    code: 0,
    data: {
        username: '202401001',
        attributes: {
            userName: '张三',
            organizationName: '计算机科学与技术2024-1班',
            identityTypeName: '学生',
            organizationCode: 'CS2024-1'
        }
    }
};

/** Mock JSON - 一卡通信息 */
export const MOCK_ECARD_JSON = {
    code: '0',
    data: {
        cardWallet: '125.50',
        cardStatus: '正常',
        dbTime: '2025-12-10 10:30:00'
    }
};

/** Mock JSON - 一卡通错误响应 */
export const MOCK_ECARD_ERROR_JSON = {
    code: '500',
    msg: '查询失败',
    data: null
};

/** 测试用 Token */
export const TEST_TOKENS = {
    VALID: '550e8400-e29b-41d4-a716-446655440000',
    INVALID_FORMAT: 'invalid-token-123',
    NON_EXISTENT: '550e8400-e29b-41d4-a716-446655440999',
};

/** 测试用学号 */
export const TEST_STUDENT_IDS = {
    VALID: '202401001',
    INVALID_SHORT: '12345',
    INVALID_LETTERS: '2024abc01',
    SQL_INJECTION: "202401001' OR '1'='1",
};

/** 测试用密码 */
export const TEST_PASSWORDS = {
    VALID: 'Password123',
    TOO_SHORT: '12345',
    TOO_LONG: 'a'.repeat(51),
    XSS_ATTACK: '<script>alert("xss")</script>',
};

/** 测试用验证码 */
export const TEST_CAPTCHA_CODES = {
    VALID: 'AB12',
    INVALID_LENGTH: '123',
    INVALID_CHARS: 'AB@#',
};

/** 测试用 IP 地址 */
export const TEST_IPS = {
    NORMAL: '192.168.1.100',
    PROXY: '10.0.0.1',
    IPV6: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
};

/** Mock Cookies */
export const MOCK_COOKIES = {
    SESSION: 'JSESSIONID=ABC123DEF456; Path=/; HttpOnly',
    CAS_TGT: 'CASTGC=TGT-123-ABC; Path=/cas; Secure',
};

/** Mock execution 参数 */
export const MOCK_EXECUTION = 'e1s1';

/** 攻击测试用例 */
export const ATTACK_PAYLOADS = {
    SQL_INJECTION: [
        "' OR '1'='1",
        "'; DROP TABLE users--",
        "admin'--",
        "1' UNION SELECT NULL--",
    ],
    XSS: [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert("xss")>',
        'javascript:alert("xss")',
        '<svg onload=alert("xss")>',
    ],
    PATH_TRAVERSAL: [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '%2e%2e%2f%2e%2e%2f',
    ],
    COMMAND_INJECTION: [
        '; ls -la',
        '| cat /etc/passwd',
        '`whoami`',
        '$(reboot)',
    ],
};

/** 并发测试配置 */
export const CONCURRENT_TEST_CONFIG = {
    LOW_LOAD: 10,
    MEDIUM_LOAD: 50,
    HIGH_LOAD: 100,
    STRESS_LOAD: 500,
};

/** 缓存测试数据 */
export const CACHE_TEST_DATA = {
    SCHEDULE: {
        week: '第15周',
        courses: [
            { day: 2, section: '第1节', name: '高等数学', location: 'A101', teacher: '张三', weekStr: '1-16周' }
        ]
    },
    USER_INFO: {
        name: '测试用户',
        studentId: '202401001',
        className: '测试班级',
        identity: '学生',
        organizationCode: 'TEST'
    },
    ECARD: {
        balance: 99.99,
        status: '正常',
        lastTime: '2025-12-10 10:00:00'
    }
};

/** 扩展的登录测试数据集 */
export const LOGIN_TEST_DATASETS = {
    VALID: {
        sessionId: TEST_TOKENS.VALID,
        username: '202401001',
        password: 'Password123',
        code: 'AB12'
    },
    INVALID_STUDENT_ID_SHORT: {
        sessionId: TEST_TOKENS.VALID,
        username: '123',
        password: 'Password123',
        code: 'AB12'
    },
    INVALID_STUDENT_ID_SPECIAL_CHARS: {
        sessionId: TEST_TOKENS.VALID,
        username: '2024-01-001',
        password: 'Password123',
        code: 'AB12'
    },
    INVALID_PASSWORD_SHORT: {
        sessionId: TEST_TOKENS.VALID,
        username: '202401001',
        password: '123',
        code: 'AB12'
    },
    INVALID_PASSWORD_LONG: {
        sessionId: TEST_TOKENS.VALID,
        username: '202401001',
        password: 'a'.repeat(51),
        code: 'AB12'
    },
    INVALID_CODE_LENGTH: {
        sessionId: TEST_TOKENS.VALID,
        username: '202401001',
        password: 'Password123',
        code: '1'
    },
    INVALID_CODE_SPECIAL_CHARS: {
        sessionId: TEST_TOKENS.VALID,
        username: '202401001',
        password: 'Password123',
        code: 'AB@#'
    },
    SQL_INJECTION_USERNAME: {
        sessionId: TEST_TOKENS.VALID,
        username: "' OR '1'='1",
        password: 'Password123',
        code: 'AB12'
    },
    XSS_PASSWORD: {
        sessionId: TEST_TOKENS.VALID,
        username: '202401001',
        password: '<script>alert("xss")</script>',
        code: 'AB12'
    }
};

/** 真实样本数据集（脱敏后的真实结构） */
export const REAL_LIKE_FIXTURES = {
    /** 真实课表 HTML 样本 */
    SCHEDULE_HTML_COMPLEX: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>课程表</title></head>
<body>
<script>
var li_showWeek = '2024-2025学年第一学期第15周';
</script>
<table class="kb_table">
<tbody>
<tr>
    <td>第1节</td>
    <td></td>
    <td>
        <div class="kb_content">
            <p title="课程名称：高等数学（上）<br/>上课地点：教学楼A-301<br/>教师：张教授<br/>上课时间：1-16周"></p>
        </div>
    </td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
</tr>
<tr>
    <td>第3节</td>
    <td></td>
    <td></td>
    <td>
        <div class="kb_content">
            <p title="课程名称：大学英语<br/>上课地点：外语楻B-201<br/>教师：李老师<br/>上课时间：1-18周(单周)"></p>
        </div>
    </td>
    <td></td>
    <td></td>
    <td></td>
</tr>
<tr>
    <td>第5节</td>
    <td></td>
    <td></td>
    <td></td>
    <td>
        <div class="kb_content">
            <p title="课程名称：数据结构与算法<br/>上课地点：实验楼303<br/>教师：王副教授<br/>上课时间：1-16周"></p>
        </div>
    </td>
    <td></td>
    <td></td>
    <td></td>
</tr>
</tbody>
</table>
</body>
</html>
    `,
    
    /** 真实用户信息 JSON 样本 */
    USER_INFO_JSON_COMPLETE: {
        code: 0,
        data: {
            username: '202401001',
            attributes: {
                userName: '测试学生',
                organizationName: '计算机科学与技术2024-1班',
                identityTypeName: '学生',
                organizationCode: 'CS2024-1',
                email: 'test@example.edu.cn',
                phone: '13800138000'
            }
        }
    },
    
    /** 真实一卡通 JSON 样本 */
    ECARD_JSON_WITH_TRANSACTIONS: {
        code: '0',
        data: {
            cardWallet: '125.50',
            cardStatus: '正常',
            dbTime: '2025-12-10 10:30:00',
            transactions: [
                { type: '消费', amount: '-12.50', merchant: '食堂一楼', time: '2025-12-10 08:00' },
                { type: '充值', amount: '+100.00', merchant: '自助机', time: '2025-12-09 18:00' }
            ]
        }
    }
};
