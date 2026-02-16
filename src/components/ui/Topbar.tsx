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
    <header className="sticky top-0 z-20 border-b border-[var(--line)]/90 glass-panel">
      <div className="mx-auto max-w-md px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold leading-tight text-[var(--text)]">{title}</div>
            {subtitle ? (
              <p className="mt-1 text-xs text-[var(--text-muted)]">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {action}
            <Link
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
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
