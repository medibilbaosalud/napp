"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getWeekStartMonday, formatDateISO } from "@/lib/date/week";
import { Topbar } from "@/components/ui/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils/cn";

const obstacleOptions = [
  { code: "time", label: "Tiempo" },
  { code: "social", label: "Social" },
  { code: "stress", label: "Estrés" },
  { code: "planning", label: "Planificación" },
  { code: "emotional", label: "Hambre emocional" },
  { code: "sleep", label: "Sueño" },
];

type Difficulty = "good" | "normal" | "hard";

export default function WeeklyReviewPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const weekStartIso = React.useMemo(
    () => formatDateISO(getWeekStartMonday(new Date())),
    [],
  );

  const [difficulty, setDifficulty] = React.useState<Difficulty>("normal");
  const [obstacles, setObstacles] = React.useState<string[]>([]);
  const [win, setWin] = React.useState("");
  const [adjust, setAdjust] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  function toggle(code: string) {
    setObstacles((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= 3) return prev;
      return [...prev, code];
    });
  }

  async function submit() {
    setMsg(null);
    setBusy(true);
    try {
      const payload = obstacles.map((code) => ({ code }));
      const { error } = await supabase.rpc("submit_weekly_review", {
        p_week_start: weekStartIso,
        p_difficulty: difficulty,
        p_obstacles: payload,
        p_win: win,
        p_adjust: adjust,
      });
      if (error) {
        setMsg(error.message);
        return;
      }
      setMsg("Revisión enviada. Tu nutricionista responderá con 2–3 ajustes.");
      setTimeout(() => {
        router.push("/app/patient/chat");
        router.refresh();
      }, 900);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <Topbar title="Revisión semanal" />
      <div className="px-4 py-4 space-y-4">
        <Card>
          <div className="text-sm font-semibold text-slate-900">Semana</div>
          <div className="text-sm text-slate-600">{weekStartIso}</div>
          <p className="mt-2 text-xs text-slate-500">
            1–2 minutos. Sin culpa: buscamos ajustar, no juzgar.
          </p>
        </Card>

        <Card>
          <div className="text-sm font-semibold text-slate-900">Mi semana fue</div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(
              [
                ["good", "Buena"],
                ["normal", "Normal"],
                ["hard", "Difícil"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setDifficulty(v)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm",
                  difficulty === v
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-slate-200 bg-white text-slate-700",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <div className="text-sm font-semibold text-slate-900">
            Obstáculos (elige hasta 3)
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {obstacleOptions.map((o) => (
              <button
                key={o.code}
                onClick={() => toggle(o.code)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  obstacles.includes(o.code)
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Si ya tienes 3, desmarca uno para cambiar.
          </p>
        </Card>

        <Card className="space-y-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">1 victoria</div>
            <Input value={win} onChange={(e) => setWin(e.target.value)} placeholder="Ej: mantuve el desayuno 5 días" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">1 ajuste</div>
            <Input value={adjust} onChange={(e) => setAdjust(e.target.value)} placeholder="Ej: cenas más fáciles entre semana" />
          </div>
        </Card>

        {msg ? (
          <Card>
            <p className="text-sm text-slate-700">{msg}</p>
          </Card>
        ) : null}

        <Button className="w-full" onClick={submit} disabled={busy}>
          Enviar revisión
        </Button>
      </div>
    </div>
  );
}

