import { NextResponse } from "next/server";
import { callBackendJson } from "../../../lib/backend";
import type { ApiResponse, ECard } from "../../../types/api";

export async function GET() {
  const result = await callBackendJson<ApiResponse<ECard>>("/api/ecard", { method: "GET" });

  if (!result.ok) {
    return NextResponse.json(
      result.data ?? { code: result.status, msg: "获取一卡通数据失败" },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data);
}
