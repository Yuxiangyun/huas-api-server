"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { PageHeader } from "../layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Skeleton } from "../ui/skeleton";
import { LogOut } from "lucide-react";
import { useAuthStore } from "../../stores/auth-store";
import { usePreferencesStore } from "../../stores/preferences-store";
import { Badge } from "../ui/badge";

export function ProfilePage() {
  const { setUser, clear } = useAuthStore();
  const { darkMode, setDarkMode } = usePreferencesStore();

  const userQuery = useQuery({
    queryKey: ["user"],
    queryFn: () => apiClient.user(),
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: apiClient.logout,
    onSuccess: () => {
      setUser(undefined);
      clear();
      window.location.href = "/login";
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader title="我的" description="个人信息 & 个性化偏好" />

      <Card className="mx-4">
        <CardHeader>
          <CardTitle>个人信息</CardTitle>
          <CardDescription>登录信息在前后端都将保留 30 天</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {userQuery.isLoading ? (
            <>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
            </>
          ) : userQuery.data?.data ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">姓名</span>
                <span className="font-medium">{userQuery.data.data.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">学号</span>
                <span className="font-medium">{userQuery.data.data.studentId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">班级</span>
                <span className="font-medium">
                  {userQuery.data.data.className || "未填写"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">来源</span>
                <Badge variant="secondary">{userQuery.data.data._source || "未知"}</Badge>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">未登录或未获取到信息</p>
          )}
        </CardContent>
      </Card>

      <Card className="mx-4">
        <CardHeader>
          <CardTitle>个性化设置</CardTitle>
          <CardDescription>偏好使用 Zustand 持久化，独立于登录态</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingRow
            title="深色模式"
            desc="跟随系统或手动切换"
            checked={darkMode}
            onCheckedChange={setDarkMode}
          />
        </CardContent>
      </Card>

      <div className="px-4 pb-4">
        <Button
          variant="outline"
          className="w-full text-destructive"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {logoutMutation.isPending ? "退出中..." : "退出登录"}
        </Button>
      </div>
    </div>
  );
}

function SettingRow({
  title,
  desc,
  checked,
  onCheckedChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onCheckedChange: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
