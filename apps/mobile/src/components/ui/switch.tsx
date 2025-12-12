"use client";

import { forwardRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  onCheckedChange?: (checked: boolean) => void;
};

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  {
    className,
    checked: controlled,
    defaultChecked,
    onChange,
    onCheckedChange,
    disabled,
    ...props
  },
  ref,
) {
  const [uncontrolled, setUncontrolled] = useState<boolean>(Boolean(defaultChecked));
  const isControlled = controlled !== undefined;
  const isChecked = isControlled ? controlled : uncontrolled;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      aria-disabled={disabled}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors",
        isChecked ? "bg-primary" : "bg-muted",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
      onClick={(event) => {
        if (disabled) return;
        const next = !isChecked;
        if (!isControlled) setUncontrolled(next);
        onCheckedChange?.(next);
        onChange?.({
          ...event,
          target: { ...event.target, checked: next },
          currentTarget: { ...event.currentTarget, checked: next },
        } as any);
      }}
      {...props}
    >
      <span
        className={cn(
          "block h-5 w-5 rounded-full bg-white shadow transition-transform",
          isChecked ? "translate-x-5" : "translate-x-1",
        )}
      />
      <input ref={ref} type="checkbox" className="sr-only" checked={isChecked} readOnly />
    </button>
  );
});
