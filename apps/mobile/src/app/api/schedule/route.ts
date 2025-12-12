import { NextResponse } from "next/server";
import { callBackendJson } from "../../../lib/backend";
import type { ApiResponse, ScheduleResponse } from "../../../types/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get("refresh");
  const query = refresh ? `?refresh=${refresh}` : "";

  const result = await callBackendJson<ApiResponse<ScheduleResponse>>(
    `/api/schedule${query}`,
    { method: "GET" },
  );

  if (!result.ok) {
    return NextResponse.json(
      result.data ?? { code: result.status, msg: "获取课表失败" },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data);
}
