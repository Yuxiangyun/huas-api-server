import { NextResponse } from "next/server";
import { callBackendJson, clearAuthCookie } from "../../../../lib/backend";
import type { ApiResponse } from "../../../../types/api";

export async function POST() {
  const result = await callBackendJson<ApiResponse<undefined>>("/auth/logout", {
    method: "POST",
  });

  clearAuthCookie();

  if (!result.ok) {
    return NextResponse.json(
      result.data ?? { code: result.status, msg: "退出失败" },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data);
}
