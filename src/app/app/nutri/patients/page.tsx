"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { NutriBoardRow } from "@/lib/types/nutri-board";
import { Topbar } from "@/components/ui/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

function badgeColor(level: NutriBoardRow["risk_level"]) {
  if (level === "high") return "bg-red-100 text-red-700 border-red-200";
  if (level === "medium") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

export default function NutriPatientsPage() {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = React.useState<NutriBoardRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("get_nutri_board_payload", {});
      if (rpcError) throw rpcError;
      const parsed = (data as unknown[]).map((row) => {
        const rec = row as Record<string, unknown>;
        return {
          patient_id: String(rec.patient_id),
          name: String(rec.name ?? rec.patient_id),
          risk_level: (rec.risk_level as NutriBoardRow["risk_level"]) ?? "low",
          risk_reasons: Array.isArray(rec.risk_reasons)
            ? rec.risk_reasons.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
            : [],
          last_checkin_at: typeof rec.last_checkin_at === "string" ? rec.last_checkin_at : null,
          adherence_14d: Number(rec.adherence_14d ?? 0),
          symptoms: {
            stress: Number((rec.symptoms as Record<string, unknown> | undefined)?.stress ?? 0),
            bloating: Number((rec.symptoms as Record<string, unknown> | undefined)?.bloating ?? 0),
            reflux: Number((rec.symptoms as Record<string, unknown> | undefined)?.reflux ?? 0),
          },
          has_pending_review: Boolean(rec.has_pending_review),
        } satisfies NutriBoardRow;
      });
      setRows(parsed);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="pb-8">
      <Topbar
        title="Board clinico"
        subtitle="Pacientes priorizados por riesgo operativo"
        action={<Button variant="secondary" onClick={refresh}>Actualizar</Button>}
      />
      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        <Card className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">Solicitudes pendientes</div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Revisa nuevas vinculaciones</p>
          </div>
          <Link href="/app/nutri/requests">
            <Button>Ir a solicitudes</Button>
          </Link>
        </Card>

        {error ? (
          <Card className="border-[var(--danger)]/30 bg-red-50">
            <p className="text-sm text-[var(--danger)]">{error}</p>
          </Card>
        ) : null}

        <Card>
          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">Cargando board...</p>
          ) : rows.length ? (
            <ul className="space-y-3">
              {rows.map((row) => (
                <li key={row.patient_id} className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text)]">{row.name}</div>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">Adherencia 14d: {row.adherence_14d}%</p>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${badgeColor(row.risk_level)}`}>
                      {row.risk_level}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {row.has_pending_review ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-amber-700">
                        <Clock3 className="h-3.5 w-3.5" /> Revision pendiente
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Al dia
                      </span>
                    )}
                    {row.risk_reasons.slice(0, 2).map((reason) => (
                      <span key={reason} className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-red-700">
                        <AlertTriangle className="h-3.5 w-3.5" /> {reason}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3">
                    <Link href={`/app/nutri/patients/${row.patient_id}`} className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]">
                      Abrir ficha {"->"}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Todavia no tienes pacientes asignados.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

