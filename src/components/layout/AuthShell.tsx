import Link from "next/link";
import { ShieldCheck, Sparkles, TimerReset } from "lucide-react";
import { Atmosphere } from "@/components/ui/Atmosphere";

const trustItems = [
  {
    icon: ShieldCheck,
    title: "Privacidad protegida",
    text: "Datos clinicos con control de acceso por paciente.",
  },
  {
    icon: TimerReset,
    title: "Menos de 1 minuto",
    text: "Registro diario y seguimiento rapido.",
  },
  {
    icon: Sparkles,
    title: "IA + nutricionista",
    text: "Asistencia continua con supervision humana.",
  },
] as const;

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh app-shell">
      <Atmosphere />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col px-4 py-8 sm:py-10">
        <header className="mb-6">
          <Link href="/" className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            MediBilbao Salud
          </Link>
          <h1 className="mt-3 text-[2rem] font-semibold leading-[1.05] text-[var(--text)]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 max-w-[32ch] text-sm text-[var(--text-muted)]">{subtitle}</p>
          ) : null}
        </header>

        <div className="auth-sheen card-glow rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--bg-elevated)]/90 p-5 shadow-[var(--shadow-md)]">
          {children}
        </div>

        <div className="mt-4 grid gap-2">
          {trustItems.map(({ icon: Icon, title: itemTitle, text }) => (
            <div
              key={itemTitle}
              className="panel-soft flex items-start gap-3 rounded-[var(--radius-md)] px-3 py-2.5"
            >
              <div className="mt-0.5 rounded-full bg-white p-1.5 text-[var(--accent)] shadow-[var(--shadow-sm)]">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--text)]">{itemTitle}</p>
                <p className="text-xs text-[var(--text-muted)]">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
