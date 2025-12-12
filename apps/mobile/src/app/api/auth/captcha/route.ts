import { NextResponse } from "next/server";
import { callBackendJson } from "../../../../lib/backend";
import type { ApiResponse, CaptchaResponse } from "../../../../types/api";

export async function GET() {
  const result = await callBackendJson<ApiResponse<CaptchaResponse>>(
    "/auth/captcha",
    {},
    { requireAuth: false },
  );

  if (!result.ok) {
    return NextResponse.json(
      result.data ?? { code: result.status, msg: "获取验证码失败" },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data);
}
