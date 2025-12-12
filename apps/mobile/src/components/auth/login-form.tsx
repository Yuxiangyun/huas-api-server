"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import Image from "next/image";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient } from "../../lib/api-client";
import { TOKEN_MAX_AGE } from "../../lib/auth";
import { useAuthStore } from "../../stores/auth-store";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";

type FormState = {
  username: string;
  password: string;
  code: string;
};

export function LoginForm() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState<FormState>({ username: "", password: "", code: "" });
  const [sessionId, setSessionId] = useState<string>("");

  const captchaQuery = useQuery({
    queryKey: ["captcha"],
    queryFn: apiClient.captcha,
    staleTime: 0,
  });

  useEffect(() => {
    if (captchaQuery.data?.data?.sessionId) {
      setSessionId(captchaQuery.data.data.sessionId);
    }
  }, [captchaQuery.data]);

  const loginMutation = useMutation({
    mutationFn: () =>
      apiClient.login({
        sessionId,
        username: form.username,
        password: form.password,
        code: form.code,
      }),
    onSuccess: (res) => {
      if (res.token) {
        setToken(res.token, TOKEN_MAX_AGE);
      }
      setUser(undefined);
      router.push("/");
      router.refresh();
    },
  });

  const errorMessage = useMemo(() => {
    if (loginMutation.isError) {
      return (loginMutation.error as Error)?.message || "登录失败";
    }
    if (captchaQuery.isError) {
      return (captchaQuery.error as Error)?.message || "验证码获取失败";
    }
    return "";
  }, [loginMutation.isError, loginMutation.error, captchaQuery.isError, captchaQuery.error]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sessionId) return;
    loginMutation.mutate();
  };

  const disableSubmit = loginMutation.isPending || !sessionId;
  const captchaImg = captchaQuery.data?.data?.image;

  return (
    <div className="mx-auto mt-8 max-w-md px-4">
      <Card>
        <CardHeader>
          <CardTitle>登录教务系统</CardTitle>
          <CardDescription>验证码获取后 30 分钟内完成登录，将保持 30 天免登</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username">学号</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={form.username}
                onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-3">
              <div className="space-y-2">
                <Label htmlFor="code">验证码</Label>
                <Input
                  id="code"
                  name="code"
                  value={form.code}
                  onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))}
                  required
                />
              </div>
              <div className="flex h-full items-end">
                {captchaQuery.isFetching ? (
                  <Skeleton className="h-11 w-28 rounded-xl" />
                ) : captchaImg ? (
                  <button
                    type="button"
                    className="relative h-11 w-28 overflow-hidden rounded-xl border border-border bg-white"
                    onClick={() => captchaQuery.refetch()}
                    disabled={captchaQuery.isFetching}
                  >
                    <Image
                      src={`data:image/png;base64,${captchaImg}`}
                      alt="验证码"
                      fill
                      sizes="112px"
                      className="object-contain"
                      priority
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="flex h-11 w-28 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground"
                    onClick={() => captchaQuery.refetch()}
                  >
                    点击刷新
                  </button>
                )}
              </div>
            </div>

            {errorMessage ? (
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{errorMessage}</span>
              </div>
            ) : null}

            <Button type="submit" disabled={disableSubmit}>
              {loginMutation.isPending ? "登录中..." : "登录"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
