"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Calendar, Home, MessageCircle, PlusCircle, TrendingUp } from "lucide-react";

const items = [
  { href: "/app/patient/today", label: "Hoy", icon: Home },
  { href: "/app/patient/plan", label: "Plan", icon: Calendar },
  { href: "/app/patient/log", label: "Registro", icon: PlusCircle },
  { href: "/app/patient/progress", label: "Progreso", icon: TrendingUp },
  { href: "/app/patient/chat", label: "Chat", icon: MessageCircle },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--line)] bg-[rgba(255,255,255,0.92)] backdrop-blur">
      <div className="mx-auto grid h-18 max-w-md grid-cols-5 px-2 pt-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] px-2 py-2 text-[11px] font-semibold text-[var(--text-muted)] transition-all",
                active && "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "scale-105")} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)] bg-transparent" />
    </nav>
  );
}
