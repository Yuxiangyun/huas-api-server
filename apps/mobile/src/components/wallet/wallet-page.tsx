"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { PageHeader } from "../layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Wallet2, RefreshCcw } from "lucide-react";

export function WalletPage() {
  const ecardQuery = useQuery({
    queryKey: ["ecard"],
    queryFn: apiClient.ecard,
    retry: false,
  });

  const isUnauthorized =
    ecardQuery.isError &&
    (ecardQuery.error as Error).message.toLowerCase().includes("未登录");

  return (
    <div className="space-y-4">
      <PageHeader title="一卡通" description="余额、交易列表实时获取，不走缓存" />

      <Card className="mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-primary/80 p-4 text-primary-foreground">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">当前余额</p>
              <p className="text-3xl font-semibold leading-tight">
                {ecardQuery.data?.data?.balance?.toFixed(2) ?? "--"}
              </p>
            </div>
            <Wallet2 className="h-10 w-10 opacity-90" />
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="mt-3 bg-white/20 text-white backdrop-blur"
            onClick={() => ecardQuery.refetch()}
            disabled={ecardQuery.isFetching}
          >
            <RefreshCcw className="mr-1 h-4 w-4" />
            刷新
          </Button>
        </div>
        <CardContent className="space-y-3">
          <CardTitle className="text-base">最近记录</CardTitle>
          {ecardQuery.isLoading ? (
            <>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </>
          ) : isUnauthorized ? (
            <p className="text-sm text-destructive">未登录，无法获取一卡通数据</p>
          ) : ecardQuery.data?.data?.transactions?.length ? (
            ecardQuery.data.data.transactions.slice(0, 5).map((tx, index) => {
              const amount = tx.amount ?? 0;
              return (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{tx.desc || tx.type}</p>
                    <p className="text-xs text-muted-foreground">{tx.time}</p>
                  </div>
                  <Badge variant={amount < 0 ? "outline" : "secondary"}>
                    {amount > 0 ? "+" : ""}
                    {amount.toFixed(2)}
                  </Badge>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">暂无交易记录</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
