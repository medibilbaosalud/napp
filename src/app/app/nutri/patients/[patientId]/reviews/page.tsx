"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
      goal: goalText.trim() || "1 acción mínima diaria.",
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
      <Topbar title="Revisiones" />
      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        <Card>
          <Link
            href={`/app/nutri/patients/${patientId}`}
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            ← Paciente
          </Link>
        </Card>

        {error ? (
          <Card className="border-red-200 bg-red-50">
            <p className="text-sm text-red-700">{error}</p>
          </Card>
        ) : null}

        {pending ? (
          <Card>
            <div className="text-sm font-semibold text-slate-900">
              Responder revisión ({pending.week_start})
            </div>
            <p className="mt-1 text-xs text-slate-500">
              2–3 cambios concretos (1 por línea) + refuerzo + objetivo.
            </p>
            <div className="mt-3 space-y-2">
              <label className="text-xs font-medium text-slate-600">Cambios (1 por línea)</label>
              <textarea
                className="h-24 w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder={"Ej:\n- Añadir snack planificado\n- Simplificar cenas 3 días"}
              />
            </div>
            <div className="mt-3 space-y-2">
              <label className="text-xs font-medium text-slate-600">Refuerzo positivo</label>
              <Input value={reinforceText} onChange={(e) => setReinforceText(e.target.value)} />
            </div>
            <div className="mt-3 space-y-2">
              <label className="text-xs font-medium text-slate-600">Objetivo semanal</label>
              <Input value={goalText} onChange={(e) => setGoalText(e.target.value)} />
            </div>
            <div className="mt-4">
              <Button onClick={() => respond(pending.id)}>Enviar respuesta</Button>
            </div>
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-slate-600">No hay revisiones pendientes.</p>
          </Card>
        )}

        <Card>
          <div className="text-sm font-semibold text-slate-900">Historial</div>
          <div className="mt-3 space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">{r.week_start}</div>
                  <div className="text-xs text-slate-500">{r.difficulty}</div>
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  Victoria: {r.win || "—"}
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  Ajuste: {r.adjust || "—"}
                </p>
                <pre className="mt-2 overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100">
                  {JSON.stringify(r.metrics, null, 2)}
                </pre>
                {r.nutri_response ? (
                  <pre className="mt-2 overflow-auto rounded-xl bg-emerald-900 p-3 text-xs text-emerald-50">
                    {JSON.stringify(r.nutri_response, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
