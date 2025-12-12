"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { CalendarClock, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "../layout/page-header";
import type { ScheduleItem } from "../../types/api";
import { cn } from "../../lib/utils";

export function HomePage() {
  const userQuery = useQuery({
    queryKey: ["user"],
    queryFn: () => apiClient.user(),
    retry: false,
  });

  const [forceRefresh, setForceRefresh] = useState(false);
  const scheduleQuery = useQuery({
    queryKey: ["schedule", forceRefresh ? "refresh" : "cache"],
    queryFn: () => apiClient.schedule(forceRefresh),
    retry: false,
  });

  const unauthorized = useMemo(() => {
    return (
      userQuery.isError &&
      (userQuery.error as Error).message.toLowerCase().includes("未登录")
    );
  }, [userQuery.isError, userQuery.error]);

  return (
    <div className="space-y-4">
      <PageHeader title="今日课表" description="服务器直出数据，前端用 TanStack Query 轻量增量刷新" />

      {unauthorized ? (
        <Card className="mx-4 border-dashed">
          <CardHeader>
            <CardTitle>还未登录</CardTitle>
            <CardDescription>登录后可查看课表和一卡通余额，免登 30 天</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/login">前往登录</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mx-4 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/20 to-primary/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary">本周安排</p>
                <p className="text-2xl font-semibold">
                  {userQuery.data?.data?.name ? `${userQuery.data.data.name} 同学` : "教务日程"}
                </p>
              </div>
              <Badge variant="secondary">
                {scheduleQuery.data?.data?._source === "cache" ? "缓存" : "实时"}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              课表占位，等待后端数据接入后填充。支持手动刷新。
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                setForceRefresh(true);
                scheduleQuery.refetch().finally(() => setForceRefresh(false));
              }}
              disabled={scheduleQuery.isFetching}
            >
              <RefreshCcw className="mr-1 h-4 w-4" />
              刷新课表
            </Button>
          </div>

          <ScheduleBoard
            loading={scheduleQuery.isLoading}
            schedule={scheduleQuery.data?.data}
            todayIdx={(new Date().getDay() + 6) % 7}
          />
        </>
      )}
    </div>
  );
}

type ScheduleBoardProps = {
  loading: boolean;
  schedule?: { week?: string; courses?: ScheduleItem[] };
  todayIdx: number;
};

function ScheduleBoard({ loading, schedule, todayIdx }: ScheduleBoardProps) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const defaultSections = ["1-2", "3-4", "5-6", "7-8", "9-10", "11-12"];

  const courses = schedule?.courses ?? [];
  const sections =
    courses.length > 0
      ? Array.from(new Set(courses.map((c) => c.section || ""))).filter(Boolean)
      : defaultSections;

  const courseMap = new Map<string, ScheduleItem[]>();
  courses.forEach((c, idx) => {
    const dayIdx = (c.day ?? 1) - 1;
    const sectionKey = c.section || defaultSections[Math.min(idx, defaultSections.length - 1)];
    const key = `${dayIdx}_${sectionKey}`;
    const arr = courseMap.get(key) || [];
    arr.push(c);
    courseMap.set(key, arr);
  });

  return (
    <Card className="mx-4 overflow-hidden border-2 border-border/80">
      <CardHeader className="flex-row items-center justify-between bg-secondary/70">
        <div>
          <CardTitle className="tracking-tight">本周课表</CardTitle>
          <CardDescription>{schedule?.week || "等待课表数据"}</CardDescription>
        </div>
        <CalendarClock className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[150vw] md:min-w-full">
              <div className="grid grid-cols-[52px_repeat(7,1fr)] text-xs text-muted-foreground">
                <div className="sticky left-0 z-20 h-full bg-secondary/70 backdrop-blur px-2 py-3 font-semibold text-foreground border-b border-r border-border">
                  周次
                </div>
                {days.map((d, i) => {
                  const isToday = i === todayIdx;
                  return (
                    <div
                      key={d}
                      className={cn(
                        "border-b border-border px-2 py-3 text-center font-semibold uppercase",
                        isToday ? "text-primary bg-primary/5" : "text-muted-foreground",
                      )}
                    >
                      {d}
                    </div>
                  );
                })}
                {sections.map((section) => (
                  <Fragment key={`row-${section}`}>
                    <div
                      className="sticky left-0 z-10 flex items-center justify-center border-b border-r border-border bg-secondary/80 px-2 py-2 font-semibold text-foreground"
                    >
                      {section}
                    </div>
                    {days.map((_, dayIdx) => {
                      const key = `${dayIdx}_${section}`;
                      const cellCourses = courseMap.get(key) || [];
                      const isToday = dayIdx === todayIdx;
                      return (
                        <div
                          key={key}
                          className={cn(
                            "relative border-b border-r border-dashed border-border/80 p-2 min-h-[90px]",
                            isToday && "bg-primary/5",
                          )}
                        >
                          {cellCourses.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground">空闲</p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {cellCourses.map((course, idx) => (
                                <div
                                  key={`${course.name}-${idx}`}
                                  className="rounded-lg border-2 border-border/80 bg-secondary/80 px-2 py-2 shadow-sm"
                                >
                                  <p className="text-sm font-semibold text-foreground line-clamp-2">
                                    {course.name}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {course.teacher || "教师待定"}
                                  </p>
                                  <p className="text-[10px] text-foreground/80">
                                    📍 {course.location?.replace?.("校本部", "") || "教室待定"}
                                  </p>
                                  {course.weeks ? (
                                    <p className="text-[10px] text-muted-foreground">
                                      {course.weeks}
                                    </p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
