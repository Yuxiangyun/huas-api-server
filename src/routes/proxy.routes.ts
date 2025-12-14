import { Hono } from 'hono';

const proxy = new Hono();

const targets = [
    { prefix: '/cas/', base: 'https://cas.huas.edu.cn' },
    { prefix: '/jsxsd/', base: 'https://xyjw.huas.edu.cn' },
    { prefix: '/portalApi/', base: 'https://portal.huas.edu.cn' },
    { prefix: '/personal/', base: 'https://authx-service.huas.edu.cn' },
];

async function forward(c: any, targetBase: string) {
    const url = new URL(c.req.url);
    const targetUrl = `${targetBase}${url.pathname}${url.search}`;

    const headers = new Headers(c.req.raw.headers);
    // Host 由目标域名决定，移除原 Host
    headers.delete('host');

    const init: RequestInit = {
        method: c.req.method,
        headers,
        redirect: 'manual'
    };

    if (!['GET', 'HEAD'].includes(c.req.method)) {
        init.body = c.req.raw.body;
    }

    const resp = await fetch(targetUrl, init);
    const respHeaders = new Headers(resp.headers);
    return new Response(resp.body, {
        status: resp.status,
        headers: respHeaders
    });
}

targets.forEach(({ prefix, base }) => {
    proxy.all(`${prefix}*`, (c) => forward(c, base));
});

export default proxy;
