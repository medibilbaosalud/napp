"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { PlanV2, PlanMealSlot, ShoppingSeedItem } from "@/lib/types/plan-v2";
import { toPlanV2 } from "@/lib/types/plan-v2";
import { getWeekStartMonday, formatDateISO } from "@/lib/date/week";
import { Topbar } from "@/components/ui/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function defaultMeal(slot: string): PlanMealSlot {
  return { slot, optionA: [""], optionB: [""], out: [""] };
}

function defaultPlan(): PlanV2 {
  return {
    schema_version: 2,
    title: "Plan semanal",
    general_notes: "Mantener constancia con acciones minimas y opciones flexibles.",
    meals: [defaultMeal("Desayuno"), defaultMeal("Comida"), defaultMeal("Cena")],
    shopping_seed: [{ name: "Verduras variadas" }, { name: "Fuente de proteina" }, { name: "Fruta" }],
    daily_focus: [
      { day: "Lunes", focus: "Preparar base de cenas" },
      { day: "Miercoles", focus: "Comida fuera de casa con ancla" },
      { day: "Viernes", focus: "Reforzar desayuno" },
    ],
  };
}

export default function NutriPlanEditorPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const [weekStart, setWeekStart] = React.useState(() => formatDateISO(getWeekStartMonday(new Date())));
  const [planId, setPlanId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"draft" | "published">("draft");
  const [plan, setPlan] = React.useState<PlanV2>(defaultPlan());
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setMsg(null);
    const { data, error } = await supabase
      .from("plans")
      .select("id,status,plan_data")
      .eq("patient_id", patientId)
      .eq("week_start", weekStart)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; status: "draft" | "published"; plan_data: unknown }>();

    if (error) {
      setMsg(error.message);
      return;
    }

    if (!data) {
      setPlanId(null);
      setStatus("draft");
      setPlan(defaultPlan());
      return;
    }

    setPlanId(data.id);
    setStatus(data.status ?? "draft");
    setPlan({ ...toPlanV2(data.plan_data), schema_version: 2 });
  }, [supabase, patientId, weekStart]);

  React.useEffect(() => {
    load();
  }, [load]);

  function updateMeal(index: number, next: Partial<PlanMealSlot>) {
    setPlan((prev) => {
      const meals = [...prev.meals];
      meals[index] = { ...meals[index], ...next };
      return { ...prev, meals };
    });
  }

  function updateMealList(index: number, key: "optionA" | "optionB" | "out", value: string) {
    updateMeal(index, {
      [key]: value
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
    });
  }

  function updateShoppingSeed(value: string) {
    const items: ShoppingSeedItem[] = value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
    setPlan((prev) => ({ ...prev, shopping_seed: items }));
  }

  function updateDailyFocus(value: string) {
    const items = value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [day, ...rest] = line.split(":");
        return {
          day: day?.trim() || "",
          focus: rest.join(":").trim() || line,
        };
      })
      .filter((x) => x.day && x.focus);
    setPlan((prev) => ({ ...prev, daily_focus: items }));
  }

  async function save(nextStatus: "draft" | "published") {
    setMsg(null);
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const payload = {
        ...plan,
        schema_version: 2,
      };

      if (!planId) {
        const { data, error } = await supabase
          .from("plans")
          .insert({
            patient_id: patientId,
            week_start: weekStart,
            plan_data: payload,
            schema_version: 2,
            status: nextStatus,
            published_at: nextStatus === "published" ? new Date().toISOString() : null,
            created_by: userData.user.id,
            updated_by: userData.user.id,
          })
          .select("id")
          .single<{ id: string }>();
        if (error) throw error;
        setPlanId(data.id);
      } else {
        const { error } = await supabase
          .from("plans")
          .update({
            plan_data: payload,
            schema_version: 2,
            status: nextStatus,
            published_at: nextStatus === "published" ? new Date().toISOString() : null,
            updated_by: userData.user.id,
          })
          .eq("id", planId);
        if (error) throw error;
      }

      setStatus(nextStatus);
      setMsg(nextStatus === "published" ? "Plan publicado correctamente." : "Borrador guardado.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Error guardando plan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-8">
      <Topbar title="Editor visual de plan" subtitle="Bloques validables y publicacion controlada" />
      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        <Card>
          <Link href={`/app/nutri/patients/${patientId}`} className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]">
            {"<-"} Paciente
          </Link>

          <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Semana (lunes)</label>
              <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
            </div>
            <span className="rounded-full border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
              {status === "published" ? "Publicado" : "Borrador"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => save("draft")} disabled={busy}>
              Guardar borrador
            </Button>
            <Button onClick={() => save("published")} disabled={busy}>
              Publicar plan
            </Button>
          </div>
          {msg ? <p className="mt-3 text-sm text-[var(--text-muted)]">{msg}</p> : null}
        </Card>

        <Card className="space-y-3">
          <div className="text-sm font-semibold text-[var(--text)]">Cabecera y notas</div>
          <Input value={plan.title ?? ""} onChange={(e) => setPlan((prev) => ({ ...prev, title: e.target.value }))} placeholder="Titulo del plan" />
          <textarea
            className="h-24 w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-white p-3 text-sm text-[var(--text)]"
            value={plan.general_notes}
            onChange={(e) => setPlan((prev) => ({ ...prev, general_notes: e.target.value }))}
            placeholder="Notas generales para la semana"
          />
        </Card>

        {plan.meals.map((meal, idx) => (
          <Card key={`${meal.slot}-${idx}`} className="space-y-3">
            <div className="text-sm font-semibold text-[var(--text)]">Bloque comida {idx + 1}</div>
            <Input
              value={meal.slot}
              onChange={(e) => updateMeal(idx, { slot: e.target.value })}
              placeholder="Slot (desayuno, comida, etc.)"
            />
            <textarea
              className="h-20 w-full rounded-[var(--radius-sm)] border border-[var(--line)] p-3 text-sm"
              value={meal.optionA.join("\n")}
              onChange={(e) => updateMealList(idx, "optionA", e.target.value)}
              placeholder="Plan A (1 item por linea)"
            />
            <textarea
              className="h-20 w-full rounded-[var(--radius-sm)] border border-[var(--line)] p-3 text-sm"
              value={meal.optionB.join("\n")}
              onChange={(e) => updateMealList(idx, "optionB", e.target.value)}
              placeholder="Plan B (1 item por linea)"
            />
            <textarea
              className="h-20 w-full rounded-[var(--radius-sm)] border border-[var(--line)] p-3 text-sm"
              value={meal.out.join("\n")}
              onChange={(e) => updateMealList(idx, "out", e.target.value)}
              placeholder="Fuera de casa (1 item por linea)"
            />
            <Input
              value={meal.notes ?? ""}
              onChange={(e) => updateMeal(idx, { notes: e.target.value })}
              placeholder="Nota del bloque (opcional)"
            />
          </Card>
        ))}

        <Card className="space-y-3">
          <div className="text-sm font-semibold text-[var(--text)]">Semilla de compra</div>
          <textarea
            className="h-28 w-full rounded-[var(--radius-sm)] border border-[var(--line)] p-3 text-sm"
            value={plan.shopping_seed.map((item) => item.name).join("\n")}
            onChange={(e) => updateShoppingSeed(e.target.value)}
            placeholder="Un item por linea"
          />
        </Card>

        <Card className="space-y-3">
          <div className="text-sm font-semibold text-[var(--text)]">Foco diario</div>
          <textarea
            className="h-28 w-full rounded-[var(--radius-sm)] border border-[var(--line)] p-3 text-sm"
            value={(plan.daily_focus ?? []).map((item) => `${item.day}: ${item.focus}`).join("\n")}
            onChange={(e) => updateDailyFocus(e.target.value)}
            placeholder="Formato: Lunes: objetivo del dia"
          />
        </Card>
      </div>
    </div>
  );
}

