"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-white/95 px-3 py-2.5 text-sm text-[var(--text)] shadow-[0_1px_0_rgba(20,34,29,0.04)] outline-none ring-0 placeholder:text-[var(--text-muted)]/68 transition-[border-color,box-shadow,background-color,transform] duration-[var(--motion-micro)] ease-[var(--ease-standard)] hover:border-[color-mix(in_srgb,var(--accent),var(--line)_70%)] focus:border-[var(--accent)] focus:bg-white focus:ring-2 focus:ring-[rgba(45,138,103,0.18)]",
        className,
      )}
      {...props}
    />
  );
});
