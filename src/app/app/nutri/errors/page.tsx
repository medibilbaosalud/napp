"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, Bug, Clock3, RefreshCcw, ShieldAlert } from "lucide-react";
import { Topbar } from "@/components/ui/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type DashboardSummary = {
  total_errors: number;
  fatal_errors: number;
  error_errors: number;
  warning_errors: number;
  unique_issues: number;
  impacted_users: number;
};

type TrendPoint = {
  day: string;
  total: number;
  fatal: number;
};

type RoutePoint = {
  route: string;
  total: number;
};

type TopIssue = {
  issue_key: string;
  error_name: string;
  error_message: string;
  severity: "warning" | "error" | "fatal";
  error_code: string | null;
  route: string | null;
  component: string | null;
  total: number;
  impacted_users: number;
  first_seen: string;
  last_seen: string;
  stack_sample: string | null;
};

type RecentIssue = {
  id: string;
  created_at: string;
  route: string | null;
  component: string | null;
  severity: "warning" | "error" | "fatal";
  error_name: string;
  error_message: string;
  error_code: string | null;
  fingerprint: string | null;
  stack_sample: string | null;
  context: Record<string, unknown>;
  environment: Record<string, unknown>;
};

type ErrorDashboard = {
  window_days: number;
  since: string;
  summary: DashboardSummary;
  daily_trend: TrendPoint[];
  routes: RoutePoint[];
  top_issues: TopIssue[];
  recent: RecentIssue[];
};

function severityBadge(severity: TopIssue["severity"] | RecentIssue["severity"]) {
  if (severity === "fatal") return "bg-red-100 text-red-700 border-red-200";
  if (severity === "error") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function SparkBars({ points }: { points: TrendPoint[] }) {
  if (!points.length) {
    return <p className="text-sm text-[var(--text-muted)]">Sin datos de tendencia en esta ventana.</p>;
  }
  const max = Math.max(1, ...points.map((p) => p.total));
  return (
    <div className="grid grid-cols-7 gap-2">
      {points.slice(-14).map((p) => (
        <div key={p.day} className="flex flex-col items-center gap-1">
          <div className="flex h-24 w-full items-end rounded-[var(--radius-sm)] bg-[var(--surface-soft)] px-1">
            <div className="w-full rounded-sm bg-[var(--danger)]" style={{ height: `${Math.max(8, (p.total / max) * 100)}%` }} />
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">{p.day.slice(-2)}</span>
        </div>
      ))}
    </div>
  );
}

export default function NutriErrorsDashboardPage() {
  const [days, setDays] = React.useState<7 | 14 | 30>(14);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [payload, setPayload] = React.useState<ErrorDashboard | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/diagnostics/dashboard?days=${days}`, { method: "GET" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; dashboard?: ErrorDashboard };
      if (!res.ok) throw new Error(data.error ?? "No se pudo cargar dashboard");
      setPayload(data.dashboard ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo cargar dashboard");
    } finally {
      setLoading(false);
    }
  }, [days]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const summary = payload?.summary;

  return (
    <div className="pb-8">
      <Topbar
        title="Dashboard de errores"
        subtitle="Diagnostico tecnico detallado y accionable"
        action={
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            <RefreshCcw className="h-4 w-4" />
            Actualizar
          </Button>
        }
      />
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">Ventana temporal</div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Desde {payload?.since ? new Date(payload.since).toLocaleString() : "-"}
            </p>
          </div>
          <div className="flex gap-2">
            {[7, 14, 30].map((value) => (
              <Button
                key={value}
                variant={days === value ? "primary" : "secondary"}
                onClick={() => setDays(value as 7 | 14 | 30)}
              >
                {value}d
              </Button>
            ))}
          </div>
        </Card>

        <Card className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">Atajos</div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Navegacion operativa para incidencia y soporte.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/app/nutri/patients">
              <Button variant="secondary">Board clinico</Button>
            </Link>
            <Link href="/app/nutri/requests">
              <Button variant="secondary">Solicitudes</Button>
            </Link>
          </div>
        </Card>

        {error ? (
          <Card className="border-[var(--danger)]/30 bg-red-50">
            <p className="text-sm text-[var(--danger)]">{error}</p>
          </Card>
        ) : null}

        <motion.div layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Total</p>
            <p className="mt-1 text-xl font-semibold text-[var(--text)]">{summary?.total_errors ?? 0}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Fatal</p>
            <p className="mt-1 text-xl font-semibold text-[var(--danger)]">{summary?.fatal_errors ?? 0}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Error</p>
            <p className="mt-1 text-xl font-semibold text-amber-700">{summary?.error_errors ?? 0}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Warning</p>
            <p className="mt-1 text-xl font-semibold text-slate-700">{summary?.warning_errors ?? 0}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Issues unicas</p>
            <p className="mt-1 text-xl font-semibold text-[var(--text)]">{summary?.unique_issues ?? 0}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Usuarios impactados</p>
            <p className="mt-1 text-xl font-semibold text-[var(--text)]">{summary?.impacted_users ?? 0}</p>
          </Card>
        </motion.div>

        <Card>
          <div className="text-sm font-semibold text-[var(--text)]">Tendencia diaria</div>
          <div className="mt-3">{loading ? <p className="text-sm text-[var(--text-muted)]">Cargando...</p> : <SparkBars points={payload?.daily_trend ?? []} />}</div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-[var(--text)]">Top incidencias</div>
            <ShieldAlert className="h-4 w-4 text-[var(--danger)]" />
          </div>
          <div className="mt-3 space-y-3">
            {loading ? (
              <p className="text-sm text-[var(--text-muted)]">Cargando incidencias...</p>
            ) : payload?.top_issues?.length ? (
              payload.top_issues.map((issue) => (
                <details key={issue.issue_key} className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-3 py-2">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text)]">{issue.error_name}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{issue.error_message}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${severityBadge(issue.severity)}`}>
                        {issue.severity}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--text-muted)]">
                      <span className="rounded-full bg-[var(--surface-soft)] px-2 py-1">Eventos: {issue.total}</span>
                      <span className="rounded-full bg-[var(--surface-soft)] px-2 py-1">Impactados: {issue.impacted_users}</span>
                      <span className="rounded-full bg-[var(--surface-soft)] px-2 py-1">Ruta: {issue.route ?? "(unknown)"}</span>
                      <span className="rounded-full bg-[var(--surface-soft)] px-2 py-1">Ultimo: {new Date(issue.last_seen).toLocaleString()}</span>
                    </div>
                  </summary>
                  <div className="mt-3 border-t border-[var(--line)] pt-3">
                    {issue.error_code ? <p className="text-xs text-[var(--text-muted)]">Codigo: {issue.error_code}</p> : null}
                    {issue.component ? <p className="text-xs text-[var(--text-muted)]">Componente: {issue.component}</p> : null}
                    {issue.stack_sample ? (
                      <pre className="mt-2 overflow-auto rounded-[var(--radius-sm)] bg-[var(--surface-soft)] p-2 text-[11px] text-[var(--text)]">
                        {issue.stack_sample}
                      </pre>
                    ) : null}
                  </div>
                </details>
              ))
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No hay incidencias registradas.</p>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-[var(--text)]">Rutas con mas errores</div>
            <Bug className="h-4 w-4 text-[var(--warning)]" />
          </div>
          <ul className="mt-3 space-y-2">
            {(payload?.routes ?? []).length ? (
              (payload?.routes ?? []).map((route) => (
                <li key={route.route} className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-3 py-2 text-sm">
                  <span className="text-[var(--text)]">{route.route}</span>
                  <span className="font-semibold text-[var(--text)]">{route.total}</span>
                </li>
              ))
            ) : (
              <li className="text-sm text-[var(--text-muted)]">Sin rutas problemáticas en esta ventana.</li>
            )}
          </ul>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-[var(--text)]">Eventos recientes</div>
            <Clock3 className="h-4 w-4 text-[var(--text-muted)]" />
          </div>
          <div className="mt-3 space-y-2">
            {(payload?.recent ?? []).length ? (
              (payload?.recent ?? []).slice(0, 20).map((event) => (
                <div key={event.id} className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">{event.error_name}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{event.error_message}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${severityBadge(event.severity)}`}>
                      {event.severity}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--text-muted)]">
                    <span className="rounded-full bg-[var(--surface-soft)] px-2 py-1">Ruta: {event.route ?? "(unknown)"}</span>
                    <span className="rounded-full bg-[var(--surface-soft)] px-2 py-1">Componente: {event.component ?? "(unknown)"}</span>
                    <span className="rounded-full bg-[var(--surface-soft)] px-2 py-1">{new Date(event.created_at).toLocaleString()}</span>
                  </div>
                  {event.stack_sample ? (
                    <pre className="mt-2 overflow-auto rounded-[var(--radius-sm)] bg-[var(--surface-soft)] p-2 text-[11px] text-[var(--text)]">
                      {event.stack_sample}
                    </pre>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Sin eventos recientes.</p>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <AlertTriangle className="h-3.5 w-3.5" />
            Datos técnicos detallados disponibles en cada incidencia (stack, contexto y entorno).
          </div>
        </Card>
      </div>
    </div>
  );
}
