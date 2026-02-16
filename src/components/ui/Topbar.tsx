import Link from "next/link";
import type { ReactNode } from "react";
import { Settings2 } from "lucide-react";

export function Topbar({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--line)]/80 glass-panel">
      <div className="mx-auto max-w-md px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold leading-tight text-[var(--text)]">{title}</div>
            {subtitle ? (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--text-muted)]">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            <Link
              aria-label="Abrir ajustes"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)]/90 bg-white/95 px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] shadow-[0_8px_18px_rgba(20,34,29,0.06)] transition-[transform,box-shadow,border-color,color] duration-[var(--motion-micro)] ease-[var(--ease-standard)] hover:-translate-y-[1px] hover:border-[var(--accent)]/30 hover:text-[var(--text)] hover:shadow-[0_14px_24px_rgba(20,34,29,0.12)]"
              href="/app/settings"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Ajustes
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
