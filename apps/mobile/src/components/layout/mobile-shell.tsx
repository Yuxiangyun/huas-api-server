import type { PropsWithChildren } from "react";
import { cn } from "../../lib/utils";

export function MobileShell({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div className="bg-background text-foreground">
      <div className={cn("mx-auto min-h-screen w-full max-w-5xl px-4 pb-24 md:pb-16", className)}>
        {children}
      </div>
    </div>
  );
}
