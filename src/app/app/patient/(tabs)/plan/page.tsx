import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWeekStartMonday, formatDateISO } from "@/lib/date/week";
import { toPlanV2 } from "@/lib/types/plan-v2";
import { Topbar } from "@/components/ui/Topbar";
import { Card } from "@/components/ui/Card";

type PlanRow = {
  id: string;
  week_start: string;
  status: "draft" | "published";
  plan_data: unknown;
};

export default async function PatientPlanPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const weekStartIso = formatDateISO(getWeekStartMonday(new Date()));

  const { data: plan } = await supabase
    .from("plans")
    .select("id,week_start,status,plan_data")
    .eq("patient_id", userData.user.id)
    .eq("week_start", weekStartIso)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<PlanRow>();

  const normalized = toPlanV2(plan?.plan_data ?? {});

  return (
    <div className="pb-24">
      <Topbar title="Plan semanal" subtitle="Opciones flexibles para la vida real" />
      <div className="space-y-4 px-4 py-4">
        <Card className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Semana</div>
            <div className="text-sm font-semibold text-[var(--text)]">{weekStartIso}</div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {plan?.status === "published" ? "Plan publicado" : "Borrador de nutricionista"}
            </p>
          </div>
          <Link
            className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
            href={`/app/patient/plan/shopping?week=${weekStartIso}`}
          >
            Lista compra
          </Link>
        </Card>

        {!plan ? (
          <Card>
            <div className="text-sm font-semibold text-[var(--text)]">Sin plan esta semana</div>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Cuando tu nutricionista publique el plan, aparecera aqui.</p>
          </Card>
        ) : (
          <>
            {normalized.general_notes ? (
              <Card>
                <div className="text-sm font-semibold text-[var(--text)]">Guia general</div>
                <p className="mt-2 text-sm text-[var(--text-muted)]">{normalized.general_notes}</p>
              </Card>
            ) : null}

            {normalized.daily_focus?.length ? (
              <Card>
                <div className="text-sm font-semibold text-[var(--text)]">Foco por dia</div>
                <ul className="mt-2 space-y-2 text-sm text-[var(--text-muted)]">
                  {normalized.daily_focus.map((focus) => (
                    <li key={focus.day} className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2">
                      <span className="font-semibold text-[var(--text)]">{focus.day}: </span>
                      {focus.focus}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {normalized.meals.map((meal, idx) => (
              <Card key={`${meal.slot}-${idx}`}>
                <div className="text-sm font-semibold text-[var(--text)]">{meal.slot || `Comida ${idx + 1}`}</div>
                <div className="mt-3 grid gap-3 text-sm">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Plan A</div>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-[var(--text)]">
                      {meal.optionA.map((item, i) => (
                        <li key={`a-${i}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Plan B</div>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-[var(--text)]">
                      {meal.optionB.map((item, i) => (
                        <li key={`b-${i}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Fuera de casa</div>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-[var(--text)]">
                      {meal.out.map((item, i) => (
                        <li key={`o-${i}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  {meal.notes ? <p className="text-sm text-[var(--text-muted)]">{meal.notes}</p> : null}
                </div>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
