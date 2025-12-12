"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CreditCard, User } from "lucide-react";
import { cn } from "../../lib/utils";

const tabs = [
  { href: "/", label: "首页", icon: CalendarDays },
  { href: "/wallet", label: "钱包", icon: CreditCard },
  { href: "/profile", label: "我的", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-around px-4 py-2">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || (tab.href !== "/" && pathname?.startsWith(tab.href));
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-3 py-1 text-xs font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "fill-primary/20")} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
