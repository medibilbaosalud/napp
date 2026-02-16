"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 ease-[var(--ease-standard)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
        variant === "primary" &&
          "bg-[var(--accent)] text-white shadow-[var(--shadow-sm)] hover:-translate-y-[1px] hover:bg-[var(--accent-strong)] hover:shadow-[var(--shadow-md)]",
        variant === "secondary" &&
          "border border-[var(--line)] bg-[var(--surface-soft)] text-[var(--text)] hover:border-[var(--accent)]/40 hover:bg-white",
        variant === "ghost" &&
          "bg-transparent text-[var(--text-muted)] hover:bg-[rgba(45,138,103,0.09)] hover:text-[var(--text)]",
        variant === "danger" &&
          "bg-[var(--danger)] text-white hover:bg-[#982f2f]",
        className,
      )}
      {...props}
    />
  );
}
