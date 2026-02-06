"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { PatientHomePayload } from "@/lib/types/engagement";
import { trackEvent } from "@/lib/telemetry/client";
import { Topbar } from "@/components/ui/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { NpsPrompt } from "@/components/feedback/NpsPrompt";

function ProgressRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="relative h-24 w-24 rounded-full border-8 border-[var(--accent-soft)] bg-white">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(var(--accent) ${clamped}%, rgba(217,240,228,0.45) ${clamped}% 100%)`,
        }}
      />
      <div className="absolute inset-2 flex items-center justify-center rounded-full bg-white text-lg font-bold text-[var(--text)]">
        {clamped}
      </div>
    </div>
  );
}

export default function TodayPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const [payload, setPayload] = React.useState<PatientHomePayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyAction, setBusyAction] = React.useState(false);
  const [showNps, setShowNps] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("get_patient_home_payload", {});
      if (rpcError) throw rpcError;
      setPayload(data as unknown as PatientHomePayload);
      trackEvent({ eventName: "view_today", context: { source: "today_tab" } });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (!payload) return;
    const alreadyDismissed = window.localStorage.getItem("nps:dismissed");
    if (!alreadyDismissed && payload.week_checkins >= 2) {
      setShowNps(true);
    }
  }, [payload]);

  async function completeAction(actionKey: string) {
    setBusyAction(true);
    try {
      const { error: rpcError } = await supabase.rpc("complete_patient_action", {
        p_action_key: actionKey,
      });
      if (rpcError) throw rpcError;
      trackEvent({ eventName: "complete_action", context: { actionKey } });
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyAction(false);
    }
  }

  const nextActionLabel =
    payload?.next_best_action === "checkin"
      ? "Registrar check-in"
      : payload?.next_best_action === "photo"
        ? "Subir foto"
        : "Revisar plan";

  return (
    <div className="pb-24">
      <Topbar title="Centro de adherencia" subtitle="Tu progreso diario, claro y accionable" />
      <div className="space-y-4 px-4 py-4">
        {error ? (
          <Card className="border-[var(--danger)]/30 bg-red-50">
            <p className="text-sm text-[var(--danger)]">{error}</p>
          </Card>
        ) : null}

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="relative overflow-hidden">
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[var(--accent-soft)]/60" />
            <div className="relative flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Score de hoy</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {loading ? "Calculando..." : payload?.nudge ?? "Sin datos suficientes"}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={() => {
                      if (payload?.next_best_action === "review_plan") {
                        router.push("/app/patient/plan");
                        return;
                      }
                      router.push("/app/patient/log");
                    }}
                  >
                    {nextActionLabel}
                  </Button>
                  <Button variant="secondary" onClick={() => completeAction("manual_done")} disabled={busyAction}>
                    Marcar hecho
                  </Button>
                </div>
              </div>
              <ProgressRing value={payload?.daily_score ?? 0} />
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <p className="text-xs text-[var(--text-muted)]">Racha</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text)]">{payload?.streak_days ?? 0}</p>
              <p className="text-xs text-[var(--text-muted)]">dias</p>
            </Card>
            <Card>
              <p className="text-xs text-[var(--text-muted)]">Check-ins</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text)]">{payload?.week_checkins ?? 0}</p>
              <p className="text-xs text-[var(--text-muted)]">esta semana</p>
            </Card>
            <Card>
              <p className="text-xs text-[var(--text-muted)]">Adherencia</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text)]">{payload?.week_adherence_pct ?? 0}%</p>
              <p className="text-xs text-[var(--text-muted)]">7 dias</p>
            </Card>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Objetivo semanal</div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {payload?.goal.current ?? 0}/{payload?.goal.target ?? 5} check-ins completados
                </p>
              </div>
              <Button variant="ghost" onClick={() => router.push("/app/patient/progress")}>Ver progreso</Button>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--accent-soft)]/50">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all"
                style={{
                  width: `${Math.min(100, Math.round(((payload?.goal.current ?? 0) / Math.max(1, payload?.goal.target ?? 5)) * 100))}%`,
                }}
              />
            </div>
          </Card>
        </motion.div>

        {showNps ? (
          <NpsPrompt
            context={{ screen: "today", week_checkins: payload?.week_checkins ?? 0 }}
            onSubmitted={() => {
              window.localStorage.setItem("nps:dismissed", "1");
              setShowNps(false);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
