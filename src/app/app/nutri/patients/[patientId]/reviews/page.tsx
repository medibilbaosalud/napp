"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ClipboardCheck, MessageCircleReply } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Topbar } from "@/components/ui/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type ReviewRow = {
  id: string;
  week_start: string;
  difficulty: "good" | "normal" | "hard";
  obstacles: unknown;
  win: string;
  adjust: string;
  metrics: unknown;
  nutri_response: unknown | null;
  submitted_at: string;
  responded_at: string | null;
};

const container = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.05, delayChildren: 0.03 },
  },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function NutriReviewsPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = React.useState<ReviewRow[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const [responseText, setResponseText] = React.useState("");
  const [goalText, setGoalText] = React.useState("");
  const [reinforceText, setReinforceText] = React.useState("");

  const load = React.useCallback(async () => {
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("weekly_reviews")
      .select("id,week_start,difficulty,obstacles,win,adjust,metrics,nutri_response,submitted_at,responded_at")
      .eq("patient_id", patientId)
      .order("week_start", { ascending: false })
      .limit(8)
      .returns<ReviewRow[]>();
    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setRows(data ?? []);
  }, [supabase, patientId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function respond(reviewId: string) {
    setError(null);
    const changes = responseText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3)
      .map((title) => ({ title }));

    const payload = {
      changes,
      reinforcement: reinforceText.trim() || "Buen trabajo por mantener el proceso.",
      goal: goalText.trim() || "1 accion minima diaria.",
    };

    const { error: rpcError } = await supabase.rpc("respond_weekly_review", {
      p_review_id: reviewId,
      p_response: payload,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setResponseText("");
    setGoalText("");
    setReinforceText("");
    await load();
  }

  const pending = rows.find((r) => !r.responded_at) ?? null;

  return (
    <div className="pb-8">
      <Topbar title="Revisiones" subtitle="Devuelve feedback concreto y accionable" />

      <motion.div variants={container} initial="hidden" animate="show" className="mx-auto max-w-md space-y-4 px-4 py-4">
        <motion.div variants={item}>
          <Card>
            <Link href={`/app/nutri/patients/${patientId}`} className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]">
              {"<-"} Paciente
            </Link>
          </Card>
        </motion.div>

        {error ? (
          <motion.div variants={item}>
            <Card className="border-[var(--danger)]/30 bg-red-50">
              <p className="text-sm text-[var(--danger)]">{error}</p>
            </Card>
          </motion.div>
        ) : null}

        <motion.div variants={item}>
          {pending ? (
            <Card>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                <MessageCircleReply className="h-4 w-4 text-[var(--accent)]" />
                Responder revision ({pending.week_start})
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">2-3 cambios concretos (1 por linea) + refuerzo + objetivo.</p>

              <div className="mt-3 space-y-2">
                <label className="text-xs font-medium text-[var(--text-muted)]">Cambios (1 por linea)</label>
                <textarea
                  className="h-24 w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-white p-2 text-sm text-[var(--text)]"
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder={"Ej:\n- Anadir snack planificado\n- Simplificar cenas 3 dias"}
                />
              </div>
              <div className="mt-3 space-y-2">
                <label className="text-xs font-medium text-[var(--text-muted)]">Refuerzo positivo</label>
                <Input value={reinforceText} onChange={(e) => setReinforceText(e.target.value)} />
              </div>
              <div className="mt-3 space-y-2">
                <label className="text-xs font-medium text-[var(--text-muted)]">Objetivo semanal</label>
                <Input value={goalText} onChange={(e) => setGoalText(e.target.value)} />
              </div>
              <div className="mt-4">
                <Button onClick={() => respond(pending.id)}>
                  <ClipboardCheck className="h-4 w-4" />
                  Enviar respuesta
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-[var(--text-muted)]">No hay revisiones pendientes.</p>
            </Card>
          )}
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <div className="text-sm font-semibold text-[var(--text)]">Historial</div>
            <div className="mt-3 space-y-3">
              {rows.map((r) => (
                <motion.div key={r.id} whileHover={{ y: -1 }} className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-white p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-[var(--text)]">{r.week_start}</div>
                    <div className="text-xs text-[var(--text-muted)]">{r.difficulty}</div>
                  </div>
                  <p className="mt-2 text-sm text-[var(--text)]">Victoria: {r.win || "-"}</p>
                  <p className="mt-1 text-sm text-[var(--text)]">Ajuste: {r.adjust || "-"}</p>
                  <pre className="mt-2 overflow-auto rounded-[var(--radius-sm)] bg-[var(--text)] p-3 text-xs text-white">
                    {JSON.stringify(r.metrics, null, 2)}
                  </pre>
                  {r.nutri_response ? (
                    <pre className="mt-2 overflow-auto rounded-[var(--radius-sm)] bg-[var(--accent-strong)] p-3 text-xs text-white">
                      {JSON.stringify(r.nutri_response, null, 2)}
                    </pre>
                  ) : null}
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
