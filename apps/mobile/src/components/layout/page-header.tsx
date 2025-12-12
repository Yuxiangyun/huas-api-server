import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-2 px-1 pb-3 pt-6 md:flex-row md:items-center md:justify-between md:px-4", className)}>
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">HUAS 教务助手</p>
        <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}
