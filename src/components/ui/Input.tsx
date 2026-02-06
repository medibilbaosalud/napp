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
        "w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--text)] outline-none ring-0 placeholder:text-[var(--text-muted)]/60 transition-all duration-200 ease-[var(--ease-standard)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[rgba(47,143,106,0.2)]",
        className,
      )}
      {...props}
    />
  );
});
