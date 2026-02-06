"use client";

import * as React from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getWeekStartMonday, formatDateISO } from "@/lib/date/week";
import { trackEvent } from "@/lib/telemetry/client";
import { Topbar } from "@/components/ui/Topbar";
import { Card } from "@/components/ui/Card";

type LogRow = {
  adherence: "cumpli" | "a_medias" | "no" | null;
  energy: number | null;
  hunger: number | null;
  logged_at: string;
};

type SymptomRow = {
  bloating: number;
  stress: number;
  logged_on: string;
};

function scoreAdherence(v: LogRow["adherence"]) {
  if (v === "cumpli") return 100;
  if (v === "a_medias") return 50;
  return 0;
}

function SparkBars({
  data,
  max,
  color,
}: {
  data: Array<{ day: string; value: number }>;
  max: number;
  color: string;
}) {
  if (!data.length) {
    return <p className="text-sm text-[var(--text-muted)]">Sin datos suficientes.</p>;
  }
  return (
    <div className="grid grid-cols-7 gap-2">
      {data.slice(-14).map((d) => (
        <div key={`${d.day}-${d.value}`} className="flex flex-col items-center gap-1">
          <div className="flex h-24 w-full items-end rounded-[var(--radius-sm)] bg-[var(--surface-soft)] px-1">
            <div className="w-full rounded-sm" style={{ height: `${Math.max(8, (d.value / max) * 100)}%`, background: color }} />
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">{d.day.slice(-2)}</span>
        </div>
      ))}
    </div>
  );
}

export default function ProgressPage() {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [adherenceSeries, setAdherenceSeries] = React.useState<Array<{ day: string; value: number }>>([]);
  const [energySeries, setEnergySeries] = React.useState<Array<{ day: string; value: number }>>([]);
  const [hungerSeries, setHungerSeries] = React.useState<Array<{ day: string; value: number }>>([]);
  const [stressSeries, setStressSeries] = React.useState<Array<{ day: string; value: number }>>([]);
  const [highlights, setHighlights] = React.useState<string[]>([]);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const weekStart = getWeekStartMonday(new Date());
        const from = new Date(weekStart);
        from.setDate(from.getDate() - 14);

        const { data: logs, error: logsError } = await supabase
          .from("logs")
          .select("adherence,energy,hunger,logged_at")
          .eq("patient_id", userData.user.id)
          .eq("type", "checkin")
          .gte("logged_at", from.toISOString())
          .order("logged_at", { ascending: true })
          .returns<LogRow[]>();
        if (logsError) throw logsError;

        const grouped = new Map<string, LogRow[]>();
        for (const log of logs ?? []) {
          const key = log.logged_at.slice(0, 10);
          const arr = grouped.get(key) ?? [];
          arr.push(log);
          grouped.set(key, arr);
        }

        const adherenceData: Array<{ day: string; value: number }> = [];
        const energyData: Array<{ day: string; value: number }> = [];
        const hungerData: Array<{ day: string; value: number }> = [];

        Array.from(grouped.entries()).forEach(([day, rows]) => {
          const adherence = Math.round(rows.reduce((acc, row) => acc + scoreAdherence(row.adherence), 0) / rows.length);
          const energies = rows.map((r) => r.energy).filter((v): v is number => typeof v === "number");
          const hungers = rows.map((r) => r.hunger).filter((v): v is number => typeof v === "number");
          adherenceData.push({ day, value: adherence });
          energyData.push({ day, value: energies.length ? Number((energies.reduce((a, b) => a + b, 0) / energies.length).toFixed(1)) : 0 });
          hungerData.push({ day, value: hungers.length ? Number((hungers.reduce((a, b) => a + b, 0) / hungers.length).toFixed(1)) : 0 });
        });

        setAdherenceSeries(adherenceData);
        setEnergySeries(energyData);
        setHungerSeries(hungerData);

        const { data: symptoms, error: symError } = await supabase
          .from("symptoms")
          .select("bloating,stress,logged_on")
          .eq("patient_id", userData.user.id)
          .gte("logged_on", formatDateISO(from))
          .order("logged_on", { ascending: true })
          .returns<SymptomRow[]>();
        if (symError) throw symError;

        setStressSeries((symptoms ?? []).map((s) => ({ day: s.logged_on, value: s.stress })));

        const insight: string[] = [];
        const latestAdherence = adherenceData.at(-1)?.value ?? 0;
        if (latestAdherence >= 70) insight.push("Buen ritmo: mantienes una adherencia alta en los ultimos dias.");
        if (latestAdherence < 50) insight.push("Conviene simplificar el plan 2-3 dias para recuperar inercia.");
        const latestStress = (symptoms ?? []).at(-1)?.stress ?? 0;
        if (latestStress >= 3) insight.push("El estres aparece alto: prueba una comida ancla facil hoy.");
        if (!insight.length) insight.push("Sigue registrando; con 3-4 check-ins semanales ya vemos tendencias fiables.");
        setHighlights(insight);

        trackEvent({ eventName: "view_progress", context: { points: adherenceData.length } });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  return (
    <div className="pb-24">
      <Topbar title="Progreso" subtitle="Tendencias utiles, sin juicio" />
      <div className="space-y-4 px-4 py-4">
        {error ? (
          <Card className="border-[var(--danger)]/30 bg-red-50">
            <p className="text-sm text-[var(--danger)]">{error}</p>
          </Card>
        ) : null}

        <Card>
          <div className="text-sm font-semibold text-[var(--text)]">Adherencia (0-100)</div>
          <div className="mt-3">
            {loading ? <p className="text-sm text-[var(--text-muted)]">Cargando...</p> : <SparkBars data={adherenceSeries} max={100} color="#2f8f6a" />}
          </div>
        </Card>

        <Card>
          <div className="text-sm font-semibold text-[var(--text)]">Energia</div>
          <div className="mt-3">
            {loading ? <p className="text-sm text-[var(--text-muted)]">Cargando...</p> : <SparkBars data={energySeries} max={5} color="#2f8f6a" />}
          </div>
        </Card>

        <Card>
          <div className="text-sm font-semibold text-[var(--text)]">Hambre</div>
          <div className="mt-3">
            {loading ? <p className="text-sm text-[var(--text-muted)]">Cargando...</p> : <SparkBars data={hungerSeries} max={5} color="#d18f2d" />}
          </div>
        </Card>

        {stressSeries.length ? (
          <Card>
            <div className="text-sm font-semibold text-[var(--text)]">Estres digestivo</div>
            <div className="mt-3">
              <SparkBars data={stressSeries} max={3} color="#b13e3e" />
            </div>
          </Card>
        ) : null}

        <Card>
          <div className="text-sm font-semibold text-[var(--text)]">Resumen de la semana</div>
          <ul className="mt-2 space-y-2 text-sm text-[var(--text-muted)]">
            {highlights.map((h) => (
              <li key={h} className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2">
                {h}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}