"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Flag, Sparkles } from "lucide-react";
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
  { code: "stress", label: "Estres" },
  { code: "planning", label: "Planificacion" },
  { code: "emotional", label: "Hambre emocional" },
  { code: "sleep", label: "Sueno" },
];

type Difficulty = "good" | "normal" | "hard";

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

export default function WeeklyReviewPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const weekStartIso = React.useMemo(() => formatDateISO(getWeekStartMonday(new Date())), []);

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
      setMsg("Revision enviada. Tu nutricionista respondera con 2-3 ajustes.");
      setTimeout(() => {
        router.push("/app/patient/chat");
        router.refresh();
      }, 900);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh app-shell pb-28">
      <Topbar title="Revision semanal" subtitle="Ajustamos el plan en base a la semana real" />

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-4 px-4 py-4">
        <motion.div variants={item}>
          <Card className="relative overflow-hidden">
            <motion.div
              className="absolute -right-7 -top-7 h-24 w-24 rounded-full bg-[var(--accent-soft)]/70"
              animate={{ scale: [1, 1.18, 1], opacity: [0.4, 0.72, 0.4] }}
              transition={{ duration: 7, repeat: Infinity }}
            />
            <div className="relative">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">Semana</div>
              <div className="mt-1 text-base font-semibold text-[var(--text)]">{weekStartIso}</div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">1-2 minutos. Buscamos ajustar, no juzgar.</p>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <div className="text-sm font-semibold text-[var(--text)]">Mi semana fue</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([
                ["good", "Buena"],
                ["normal", "Normal"],
                ["hard", "Dificil"],
              ] as const).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setDifficulty(v)}
                  className={cn(
                    "rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-medium",
                    difficulty === v
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                      : "border-[var(--line)] bg-white text-[var(--text-muted)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <div className="text-sm font-semibold text-[var(--text)]">Obstaculos (elige hasta 3)</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {obstacleOptions.map((o) => (
                <button
                  key={o.code}
                  onClick={() => toggle(o.code)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium",
                    obstacles.includes(o.code)
                      ? "border-[var(--text)] bg-[var(--text)] text-white"
                      : "border-[var(--line)] bg-white text-[var(--text-muted)]",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Si ya tienes 3, desmarca uno para cambiar.</p>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="space-y-3">
            <div>
              <div className="text-sm font-semibold text-[var(--text)]">1 victoria</div>
              <Input value={win} onChange={(e) => setWin(e.target.value)} placeholder="Ej: mantuve el desayuno 5 dias" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--text)]">1 ajuste</div>
              <Input value={adjust} onChange={(e) => setAdjust(e.target.value)} placeholder="Ej: cenas mas faciles entre semana" />
            </div>
          </Card>
        </motion.div>

        {msg ? (
          <motion.div variants={item}>
            <Card className={cn("py-3", msg.includes("enviada") ? "border-[var(--accent)]/30 bg-[var(--accent-soft)]/45" : "border-[var(--danger)]/30 bg-red-50")}>
              <p className={cn("text-sm", msg.includes("enviada") ? "text-[var(--text)]" : "text-[var(--danger)]")}>{msg}</p>
            </Card>
          </motion.div>
        ) : null}

        <motion.div variants={item}>
          <Button className="w-full" onClick={submit} disabled={busy}>
            <Flag className="h-4 w-4" />
            Enviar revision
            <Sparkles className="h-4 w-4" />
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
