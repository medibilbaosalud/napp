"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, Search, SlidersHorizontal, Users } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { NutriBoardRow } from "@/lib/types/nutri-board";
import { trackEvent } from "@/lib/telemetry/client";
import { Topbar } from "@/components/ui/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function badgeColor(level: NutriBoardRow["risk_level"]) {
  if (level === "high") return "bg-red-100 text-red-700 border-red-200";
  if (level === "medium") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function riskWeight(level: NutriBoardRow["risk_level"]) {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

function daysSince(isoDate: string | null) {
  if (!isoDate) return null;
  const ms = Date.now() - new Date(isoDate).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

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
  show: { opacity: 1, y: 0, transition: { duration: 0.32 } },
};

export default function NutriPatientsPage() {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = React.useState<NutriBoardRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState("");
  const [riskFilter, setRiskFilter] = React.useState<"all" | NutriBoardRow["risk_level"]>("all");
  const [onlyPending, setOnlyPending] = React.useState(false);
  const [challengeTitle, setChallengeTitle] = React.useState("");
  const [challengeDescription, setChallengeDescription] = React.useState("");
  const [creatingChallenge, setCreatingChallenge] = React.useState(false);

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

  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows = React.useMemo(() => {
    return rows
      .filter((row) => {
        if (riskFilter !== "all" && row.risk_level !== riskFilter) return false;
        if (onlyPending && !row.has_pending_review) return false;
        if (!normalizedQuery) return true;
        return (
          row.name.toLowerCase().includes(normalizedQuery) ||
          row.patient_id.toLowerCase().includes(normalizedQuery)
        );
      })
      .sort((a, b) => {
        const riskDelta = riskWeight(b.risk_level) - riskWeight(a.risk_level);
        if (riskDelta !== 0) return riskDelta;
        if (a.has_pending_review !== b.has_pending_review) {
          return a.has_pending_review ? -1 : 1;
        }
        return a.adherence_14d - b.adherence_14d;
      });
  }, [rows, riskFilter, onlyPending, normalizedQuery]);

  const highRisk = rows.filter((r) => r.risk_level === "high").length;
  const pendingReviews = rows.filter((r) => r.has_pending_review).length;
  const staleCheckins = rows.filter((r) => {
    const days = daysSince(r.last_checkin_at);
    return days == null || days >= 3;
  }).length;

  async function createChallenge() {
    if (!challengeTitle.trim()) {
      setError("El reto necesita titulo.");
      return;
    }

    setCreatingChallenge(true);
    setError(null);
    try {
      const patientIds = filteredRows.slice(0, 5).map((row) => row.patient_id);
      const res = await fetch("/api/challenges/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: challengeTitle.trim(),
          description: challengeDescription.trim(),
          patientIds,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; challengeId?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear reto.");

      trackEvent({
        schemaVersion: 2,
        eventName: "challenge_enroll",
        source: "web",
        context: { action: "nutri_create", challengeId: data.challengeId ?? null, seededPatients: patientIds.length },
      });
      setChallengeTitle("");
      setChallengeDescription("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo crear reto.");
    } finally {
      setCreatingChallenge(false);
    }
  }

  return (
    <div className="pb-8">
      <Topbar
        title="Board clinico"
        subtitle="Prioriza pacientes por riesgo y friccion operativa"
        action={<Button variant="secondary" onClick={refresh}>Actualizar</Button>}
      />

      <motion.div variants={container} initial="hidden" animate="show" className="mx-auto max-w-md space-y-4 px-4 py-4">
        <motion.div variants={item}>
          <Card className="grid grid-cols-3 gap-2">
            <motion.div whileHover={{ y: -2 }} className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-2">
              <p className="text-[11px] text-[var(--text-muted)]">Alta prioridad</p>
              <p className="text-xl font-semibold text-[var(--text)]">{highRisk}</p>
            </motion.div>
            <motion.div whileHover={{ y: -2 }} className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-2">
              <p className="text-[11px] text-[var(--text-muted)]">Reviews pendientes</p>
              <p className="text-xl font-semibold text-[var(--text)]">{pendingReviews}</p>
            </motion.div>
            <motion.div whileHover={{ y: -2 }} className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-2">
              <p className="text-[11px] text-[var(--text-muted)]">Sin check-in +3d</p>
              <p className="text-xl font-semibold text-[var(--text)]">{staleCheckins}</p>
            </motion.div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--text)]">Filtros de trabajo</div>
              <SlidersHorizontal className="h-4 w-4 text-[var(--text-muted)]" />
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                className="pl-9"
                placeholder="Buscar por nombre o id"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--text)]"
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value as "all" | NutriBoardRow["risk_level"])}
              >
                <option value="all">Todo riesgo</option>
                <option value="high">Alto</option>
                <option value="medium">Medio</option>
                <option value="low">Bajo</option>
              </select>
              <label className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={onlyPending}
                  onChange={(e) => setOnlyPending(e.target.checked)}
                />
                Solo pendientes
              </label>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--text)]">Solicitudes pendientes</div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Revisa nuevas vinculaciones</p>
            </div>
            <div className="flex gap-2">
              <Link href="/app/nutri/errors">
                <Button variant="secondary">Errores</Button>
              </Link>
              <Link href="/app/nutri/invite">
                <Button variant="secondary">Invitar</Button>
              </Link>
              <Link href="/app/nutri/requests">
                <Button>Solicitudes</Button>
              </Link>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="space-y-3">
            <div className="text-sm font-semibold text-[var(--text)]">Crear reto privado</div>
            <p className="text-xs text-[var(--text-muted)]">
              Se asigna automaticamente a los 5 pacientes filtrados con mayor prioridad.
            </p>
            <Input
              value={challengeTitle}
              onChange={(e) => setChallengeTitle(e.target.value)}
              placeholder="Ej: Reto 5 check-ins esta semana"
            />
            <Input
              value={challengeDescription}
              onChange={(e) => setChallengeDescription(e.target.value)}
              placeholder="Descripcion corta del reto"
            />
            <Button onClick={createChallenge} disabled={creatingChallenge}>
              {creatingChallenge ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear reto"}
            </Button>
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
          <Card>
            {loading ? (
              <p className="text-sm text-[var(--text-muted)]">Cargando board...</p>
            ) : filteredRows.length ? (
              <ul className="space-y-3">
                {filteredRows.map((row) => {
                  const staleDays = daysSince(row.last_checkin_at);
                  return (
                    <motion.li
                      key={row.patient_id}
                      whileHover={{ y: -2, scale: 1.01 }}
                      className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                            <Users className="h-4 w-4 text-[var(--accent)]" />
                            {row.name}
                          </div>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">Adherencia 14d: {row.adherence_14d}%</p>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">
                            Ultimo check-in: {staleDays == null ? "sin datos" : `hace ${staleDays} dia(s)`}
                          </p>
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
                    </motion.li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No hay pacientes para esos filtros.</p>
            )}
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}

