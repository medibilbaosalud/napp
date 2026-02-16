"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, Home, MessageCircle, PlusCircle, TrendingUp, Trophy } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const items = [
  { href: "/app/patient/today", label: "Hoy", icon: Home },
  { href: "/app/patient/plan", label: "Plan", icon: Calendar },
  { href: "/app/patient/log", label: "Registro", icon: PlusCircle },
  { href: "/app/patient/progress", label: "Progreso", icon: TrendingUp },
  { href: "/app/patient/challenges", label: "Retos", icon: Trophy },
  { href: "/app/patient/chat", label: "Chat", icon: MessageCircle },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
      <div className="mx-auto max-w-md px-3 pb-3">
        <div className="pointer-events-auto rounded-[1.3rem] border border-[var(--line)]/90 bg-[rgba(255,255,255,0.9)] p-1.5 shadow-[var(--shadow-md)] backdrop-blur">
          <div className="grid grid-cols-6 gap-1">
            {items.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] px-2 py-2 text-[11px] font-semibold text-[var(--text-muted)] transition-all",
                    active && "text-[var(--accent-strong)]",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="bottom-nav-pill"
                      transition={{ type: "spring", stiffness: 360, damping: 32 }}
                      className="absolute inset-0 rounded-[var(--radius-sm)] bg-[var(--accent-soft)]"
                    />
                  ) : null}
                  <motion.span whileTap={{ scale: 0.95 }} className="relative z-10 flex flex-col items-center gap-1">
                    <Icon className={cn("h-5 w-5 transition-transform", active && "scale-105")} />
                    <span>{label}</span>
                  </motion.span>
                </Link>
              );
            })}
          </div>
          <div className="h-[env(safe-area-inset-bottom)]" />
        </div>
      </div>
    </nav>
  );
}
