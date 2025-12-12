import "server-only";
import { cookies } from "next/headers";
import { TOKEN_COOKIE, TOKEN_MAX_AGE, DEFAULT_API_BASE } from "./auth";

function getApiBase() {
  return process.env.HUAS_API_BASE || DEFAULT_API_BASE;
}

export async function callBackendJson<T>(
  path: string,
  init: RequestInit = {},
  options: { requireAuth?: boolean } = { requireAuth: true },
) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.method && init.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }

  if (options.requireAuth ?? true) {
    const cookieStore = await cookies();
    const token = cookieStore.get(TOKEN_COOKIE)?.value;
    if (!token) {
      return {
        ok: false,
        status: 401,
        data: { code: 401, msg: "未登录" } as T | { code: number; msg: string },
      };
    }
    headers.set("Authorization", token);
  }

  const res = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return {
    ok: res.ok,
    status: res.status,
    data: data as T,
  };
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.set(TOKEN_COOKIE, "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
