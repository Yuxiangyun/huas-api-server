import { NextResponse } from "next/server";
import { callBackendJson } from "../../../../lib/backend";
import { TOKEN_COOKIE, TOKEN_MAX_AGE } from "../../../../lib/auth";
import type { ApiResponse, LoginParams } from "../../../../types/api";

export async function POST(request: Request) {
  const payload = (await request.json()) as LoginParams;

  const result = await callBackendJson<ApiResponse<undefined>>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { requireAuth: false },
  );

  if (!result.ok || !result.data?.token) {
    const status = result.status || 500;
    return NextResponse.json(
      result.data ?? { code: status, msg: "登录失败" },
      { status },
    );
  }

  const response = NextResponse.json(result.data);
  response.cookies.set(TOKEN_COOKIE, result.data.token, {
    maxAge: TOKEN_MAX_AGE,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
