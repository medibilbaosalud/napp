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
        "inline-flex items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-sm font-semibold tracking-tight transition-all duration-200 ease-[var(--ease-standard)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
        variant === "primary" &&
          "bg-[var(--accent)] text-white shadow-[var(--shadow-sm)] hover:bg-[var(--accent-strong)]",
        variant === "secondary" &&
          "border border-[var(--line)] bg-[var(--surface-soft)] text-[var(--text)] hover:bg-white",
        variant === "ghost" &&
          "bg-transparent text-[var(--text-muted)] hover:bg-[rgba(47,143,106,0.08)] hover:text-[var(--text)]",
        variant === "danger" &&
          "bg-[var(--danger)] text-white hover:bg-[#9f2f2f]",
        className,
      )}
      {...props}
    />
  );
}
