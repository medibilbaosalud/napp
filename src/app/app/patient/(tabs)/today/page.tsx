"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, Award, Brain, Droplets, Loader2, ShieldCheck, Sparkles, Target, Trophy } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { PatientHomePayload, PatientMission } from "@/lib/types/engagement";
import { trackEvent } from "@/lib/telemetry/client";
import { fetchPatientHomePayload } from "@/lib/services/patient-home";
import { completeMission } from "@/lib/services/challenges";
import { Topbar } from "@/components/ui/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { NpsPrompt } from "@/components/feedback/NpsPrompt";

const coachPrompts = [
  "Dame una accion mini para hoy.",
  "Como simplifico mi cena sin salir del plan?",
  "Que hago si hoy tengo ansiedad por picar?",
];

const container = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.06, delayChildren: 0.03 },
  },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

function ProgressRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <motion.div
      initial={{ scale: 0.94, opacity: 0.7 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="relative h-24 w-24 rounded-full border-8 border-[var(--accent-soft)] bg-white"
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(var(--accent) ${clamped}%, rgba(215,239,227,0.45) ${clamped}% 100%)`,
        }}
      />
      <motion.div
        className="absolute inset-2 flex items-center justify-center rounded-full bg-white text-lg font-bold text-[var(--text)]"
        animate={{ boxShadow: ["0 0 0 rgba(45,138,103,0)", "0 0 0 8px rgba(45,138,103,0.05)", "0 0 0 rgba(45,138,103,0)"] }}
        transition={{ duration: 2.4, repeat: Infinity }}
      >
        {clamped}
      </motion.div>
    </motion.div>
  );
}

function symptomLabel(value: number) {
  if (value >= 3) return "alto";
  if (value === 2) return "medio";
  if (value === 1) return "leve";
  return "bajo";
}

function rewardLabel(rewardLevel?: PatientHomePayload["reward_level"]) {
  if (rewardLevel === "gold") return "Nivel Oro";
  if (rewardLevel === "silver") return "Nivel Plata";
  if (rewardLevel === "bronze") return "Nivel Bronce";
  return "Nivel Inicial";
}

export default function TodayPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const [payload, setPayload] = React.useState<PatientHomePayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyAction, setBusyAction] = React.useState(false);
  const [showNps, setShowNps] = React.useState(false);
  const [missionBusyId, setMissionBusyId] = React.useState<string | null>(null);

  const [coachInput, setCoachInput] = React.useState("");
  const [coachAnswer, setCoachAnswer] = React.useState<string | null>(null);
  const [coachLoading, setCoachLoading] = React.useState(false);
  const [coachError, setCoachError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPatientHomePayload(supabase);
      setPayload(data);
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

  async function completeAction(actionKey: string, metadata?: Record<string, unknown>) {
    setBusyAction(true);
    try {
      const { error: rpcError } = await supabase.rpc("complete_patient_action", {
        p_action_key: actionKey,
        p_metadata: metadata ?? {},
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

  async function completeMissionAction(mission: PatientMission) {
    setMissionBusyId(mission.id);
    setError(null);
    try {
      await completeMission({
        missionId: mission.id,
        completionKey: mission.mission_key,
        value: 1,
        metadata: { source: "today_missions" },
      });
      trackEvent({
        schemaVersion: 2,
        eventName: "mission_complete",
        source: "web",
        context: { missionKey: mission.mission_key },
      });
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo completar la mision");
    } finally {
      setMissionBusyId(null);
    }
  }

  async function askCoach(rawPrompt: string) {
    const prompt = rawPrompt.trim();
    if (!prompt) return;
    setCoachLoading(true);
    setCoachError(null);

    try {
      const res = await fetch("/api/ai/plan-assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: prompt }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        answer?: string;
        error?: string;
      };

      if (!res.ok) {
        setCoachError(data.error ?? "No se pudo generar respuesta.");
        return;
      }

      setCoachAnswer(data.answer ?? "No pude generar una recomendacion.");
      trackEvent({ eventName: "ask_coach", context: { prompt_length: prompt.length } });
    } catch (e: unknown) {
      setCoachError(e instanceof Error ? e.message : "Error");
    } finally {
      setCoachLoading(false);
    }
  }

  const nextActionLabel =
    payload?.next_best_action === "checkin"
      ? "Registrar check-in"
      : payload?.next_best_action === "photo"
        ? "Subir foto"
        : "Revisar plan";

  const wellbeing = payload?.latest_symptoms ?? { stress: 0, bloating: 0, reflux: 0 };
  const missions = payload?.missions_today ?? [];

  return (
    <div className="pb-28">
      <Topbar title="Centro de adherencia" subtitle="Tu progreso diario, claro y accionable" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-4 px-4 py-4"
      >
        <AnimatePresence>
          {error ? (
            <motion.div variants={item} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className="border-[var(--danger)]/30 bg-red-50">
                <p className="text-sm text-[var(--danger)]">{error}</p>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.div variants={item}>
          <Card className="relative overflow-hidden">
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.42, 0.68, 0.42] }}
              transition={{ duration: 8, repeat: Infinity }}
              className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[var(--accent-soft)]/70"
            />
            <div className="relative flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Score de hoy</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {loading ? "Calculando..." : payload?.nudge ?? "Sin datos suficientes"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      if (payload?.next_best_action === "review_plan") {
                        router.push("/app/patient/plan");
                        return;
                      }
                      router.push("/app/patient/log");
                    }}
                  >
                    <Target className="h-4 w-4" />
                    {nextActionLabel}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => completeAction("manual_done", { source: "today_header" })}
                    disabled={busyAction}
                  >
                    Marcar hecho
                  </Button>
                </div>
              </div>
              <ProgressRing value={payload?.daily_score ?? 0} />
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item} className="grid grid-cols-3 gap-3">
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
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Gamificación saludable</div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {rewardLabel(payload?.reward_level)} · Retos activos: {payload?.weekly_challenge_status?.active ?? 0}
                </p>
              </div>
              <Award className="h-5 w-5 text-[var(--warning)]" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => router.push("/app/patient/challenges")} className="justify-start">
                <Trophy className="h-4 w-4" />
                Ver retos privados
              </Button>
              {payload?.streak_protection_available ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Proteccion de racha activa
                </span>
              ) : null}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Misiones del dia</div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Completa 2-3 acciones para reforzar constancia.
                </p>
              </div>
              <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <div className="mt-3 space-y-2">
              {missions.length ? (
                missions.map((mission) => (
                  <div
                    key={mission.id}
                    className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">{mission.title}</p>
                      <p className="text-xs text-[var(--text-muted)]">{mission.completed ? "Completada" : "Pendiente"}</p>
                    </div>
                    <Button
                      variant={mission.completed ? "secondary" : "primary"}
                      disabled={mission.completed || missionBusyId === mission.id}
                      onClick={() => completeMissionAction(mission)}
                    >
                      {missionBusyId === mission.id ? <Loader2 className="h-4 w-4 animate-spin" /> : mission.completed ? "Hecha" : "Completar"}
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[var(--text-muted)]">No hay misiones hoy. Vuelve a cargar la pantalla.</p>
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Acciones express</div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Completa mini acciones para proteger tu racha.</p>
              </div>
              <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button
                variant="secondary"
                onClick={() => completeAction("hydration", { amount_ml: 500 })}
                disabled={busyAction}
                className="justify-start"
              >
                <Droplets className="h-4 w-4" />
                Hidratacion
              </Button>
              <Button
                variant="secondary"
                onClick={() => completeAction("movement", { minutes: 10 })}
                disabled={busyAction}
                className="justify-start"
              >
                <Activity className="h-4 w-4" />
                Movimiento
              </Button>
              <Button variant="secondary" onClick={() => router.push("/app/patient/plan")} className="justify-start">
                <Target className="h-4 w-4" />
                Revisar plan
              </Button>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Coach express</div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Pregunta y recibe una recomendacion concreta basada en tu plan.</p>
              </div>
              <Brain className="h-4 w-4 text-[var(--accent)]" />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {coachPrompts.map((prompt) => (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  key={prompt}
                  className="rounded-full border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:border-[var(--accent)]/40"
                  onClick={() => askCoach(prompt)}
                  disabled={coachLoading}
                >
                  {prompt}
                </motion.button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <Input
                value={coachInput}
                onChange={(e) => setCoachInput(e.target.value)}
                placeholder="Ej: Que opcion de cena me conviene hoy?"
              />
              <Button
                onClick={() => {
                  askCoach(coachInput);
                  setCoachInput("");
                }}
                disabled={coachLoading || !coachInput.trim()}
              >
                {coachLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Preguntar"}
              </Button>
            </div>

            <AnimatePresence mode="wait">
              {coachError ? (
                <motion.p key="coach-error" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-xs text-[var(--danger)]">
                  {coachError}
                </motion.p>
              ) : null}

              {coachAnswer ? (
                <motion.div
                  key="coach-answer"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)]"
                >
                  {coachAnswer}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <div className="text-sm font-semibold text-[var(--text)]">Radar de bienestar</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([
                ["Estres", wellbeing.stress],
                ["Hinchazon", wellbeing.bloating],
                ["Reflujo", wellbeing.reflux],
              ] as const).map(([label, value]) => (
                <motion.div key={label} whileHover={{ y: -2 }} className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-white p-2">
                  <p className="text-xs text-[var(--text-muted)]">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--text)]">{value}/3</p>
                  <p className="text-xs text-[var(--text-muted)]">{symptomLabel(value)}</p>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
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
              <motion.div
                className="h-full rounded-full bg-[var(--accent)]"
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min(100, Math.round(((payload?.goal.current ?? 0) / Math.max(1, payload?.goal.target ?? 5)) * 100))}%`,
                }}
                transition={{ duration: 0.55 }}
              />
            </div>
          </Card>
        </motion.div>

        <AnimatePresence>
          {showNps ? (
            <motion.div variants={item} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <NpsPrompt
                context={{ screen: "today", week_checkins: payload?.week_checkins ?? 0 }}
                onSubmitted={() => {
                  window.localStorage.setItem("nps:dismissed", "1");
                  setShowNps(false);
                }}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
