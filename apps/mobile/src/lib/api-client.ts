import type {
  ApiResponse,
  CaptchaResponse,
  ECard,
  LoginParams,
  ScheduleResponse,
  UserProfile,
} from "../types/api";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const data = (await res.json()) as ApiResponse<T>;
  if (!res.ok || data.code !== 200) {
    const message = data?.msg || "请求失败";
    throw new Error(message);
  }
  return data;
}

export const apiClient = {
  captcha: () => fetchJson<CaptchaResponse>("/api/auth/captcha"),
  login: (payload: LoginParams) =>
    fetchJson<undefined>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logout: () =>
    fetchJson<undefined>("/api/auth/logout", {
      method: "POST",
    }),
  schedule: (refresh?: boolean) =>
    fetchJson<ScheduleResponse>(`/api/schedule${refresh ? "?refresh=true" : ""}`),
  user: (refresh?: boolean) => fetchJson<UserProfile>(`/api/user${refresh ? "?refresh=true" : ""}`),
  ecard: () => fetchJson<ECard>("/api/ecard"),
};
