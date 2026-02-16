"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Download, Save, Sparkles, UserRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { LOCALE_COOKIE } from "@/lib/supabase/constants";
import { trackEvent } from "@/lib/telemetry/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Topbar } from "@/components/ui/Topbar";
import { Atmosphere } from "@/components/ui/Atmosphere";
import { useT } from "@/components/i18n/LocaleProvider";

type PatientPreferences = {
  reminder_hour?: string;
  digestive_nudges?: boolean;
};

type CsvPrimitive = string | number | boolean | null | undefined;

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

function escapeCsv(value: CsvPrimitive) {
  const safe = value == null ? "" : String(value);
  return `"${safe.replaceAll('"', '""')}"`;
}

export default function SettingsPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const { locale, t } = useT();

  const [userId, setUserId] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [reminderHour, setReminderHour] = React.useState("20:00");
  const [digestiveNudges, setDigestiveNudges] = React.useState(false);

  const [savingLocale, setSavingLocale] = React.useState(false);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [savingPreferences, setSavingPreferences] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      setUserId(userData.user.id);

      const [{ data: profile }, { data: patient }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name,email")
          .eq("id", userData.user.id)
          .maybeSingle<{ full_name: string | null; email: string }>(),
        supabase
          .from("patients")
          .select("preferences")
          .eq("id", userData.user.id)
          .maybeSingle<{ preferences: PatientPreferences | null }>(),
      ]);

      setFullName(profile?.full_name ?? "");
      setEmail(profile?.email ?? userData.user.email ?? "");

      const prefs = patient?.preferences ?? {};
      if (prefs.reminder_hour) setReminderHour(prefs.reminder_hour);
      if (typeof prefs.digestive_nudges === "boolean") setDigestiveNudges(prefs.digestive_nudges);
    })();
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function setLocale(nextLocale: "es" | "eu") {
    setSavingLocale(true);
    setError(null);
    setStatus(null);
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      document.cookie = `${LOCALE_COOKIE}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
      setStatus("Idioma actualizado.");
      router.refresh();
    } finally {
      setSavingLocale(false);
    }
  }

  async function saveProfile() {
    if (!userId) return;
    setSavingProfile(true);
    setError(null);
    setStatus(null);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() || null })
      .eq("id", userId);

    setSavingProfile(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setStatus("Perfil guardado.");
    trackEvent({ eventName: "update_profile", context: { has_name: Boolean(fullName.trim()) } });
  }

  async function savePreferences() {
    if (!userId) return;
    setSavingPreferences(true);
    setError(null);
    setStatus(null);

    const preferences: PatientPreferences = {
      reminder_hour: reminderHour,
      digestive_nudges: digestiveNudges,
    };

    const { error: prefsError } = await supabase
      .from("patients")
      .update({ preferences })
      .eq("id", userId);

    setSavingPreferences(false);

    if (prefsError) {
      setError(prefsError.message);
      return;
    }

    setStatus("Preferencias guardadas.");
  }

  async function exportDataCsv() {
    if (!userId) return;
    setExporting(true);
    setError(null);
    setStatus(null);

    try {
      const [{ data: logs }, { data: symptoms }, { data: reviews }] = await Promise.all([
        supabase
          .from("logs")
          .select("logged_at,type,meal_slot,adherence,energy,hunger,notes,reason_codes")
          .eq("patient_id", userId)
          .order("logged_at", { ascending: true })
          .limit(1500),
        supabase
          .from("symptoms")
          .select("logged_on,bloating,reflux,bowel,stress")
          .eq("patient_id", userId)
          .order("logged_on", { ascending: true })
          .limit(1500),
        supabase
          .from("weekly_reviews")
          .select("week_start,difficulty,win,adjust,submitted_at")
          .eq("patient_id", userId)
          .order("week_start", { ascending: true })
          .limit(400),
      ]);

      const headers = [
        "dataset",
        "date",
        "type",
        "meal_slot",
        "adherence",
        "energy",
        "hunger",
        "stress",
        "bloating",
        "reflux",
        "bowel",
        "difficulty",
        "win",
        "adjust",
        "notes",
        "reason_codes",
      ];

      const rows: CsvPrimitive[][] = [];

      for (const log of logs ?? []) {
        rows.push([
          "log",
          log.logged_at,
          log.type,
          log.meal_slot,
          log.adherence,
          log.energy,
          log.hunger,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          log.notes,
          Array.isArray(log.reason_codes) ? log.reason_codes.join("|") : "",
        ]);
      }

      for (const symptom of symptoms ?? []) {
        rows.push([
          "symptom",
          symptom.logged_on,
          null,
          null,
          null,
          null,
          null,
          symptom.stress,
          symptom.bloating,
          symptom.reflux,
          symptom.bowel,
          null,
          null,
          null,
          null,
          null,
        ]);
      }

      for (const review of reviews ?? []) {
        rows.push([
          "weekly_review",
          review.week_start,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          review.difficulty,
          review.win,
          review.adjust,
          `submitted:${review.submitted_at}`,
          null,
        ]);
      }

      const csv = [
        headers.map(escapeCsv).join(","),
        ...rows.map((row) => row.map(escapeCsv).join(",")),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.setAttribute("download", `nutri-data-${dateStamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatus("Exportacion completada.");
      trackEvent({ eventName: "export_data", context: { rows: rows.length } });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo exportar.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-dvh app-shell pb-28">
      <Atmosphere />
      <div className="relative z-10">
        <Topbar title={t("settings.title")} subtitle="Controla tu experiencia y tus datos" />
        <motion.main variants={container} initial="hidden" animate="show" className="mx-auto max-w-md space-y-4 px-4 py-4">
          <motion.div variants={item}>
            <Card>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                  <UserRound className="h-4 w-4" />
                  Perfil
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--accent-strong)]">
                  <Sparkles className="h-3 w-3" /> Personal
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{email || "-"}</p>
              <div className="mt-3 space-y-2">
                <label className="text-xs font-medium text-[var(--text-muted)]">Nombre visible</label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tu nombre" />
              </div>
              <div className="mt-3">
                <Button onClick={saveProfile} disabled={savingProfile}>
                  <Save className="h-4 w-4" />
                  Guardar perfil
                </Button>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card>
              <div className="text-sm font-semibold text-[var(--text)]">{t("settings.language")}</div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant={locale === "es" ? "primary" : "secondary"}
                  onClick={() => setLocale("es")}
                  disabled={savingLocale}
                >
                  {t("settings.es")}
                </Button>
                <Button
                  variant={locale === "eu" ? "primary" : "secondary"}
                  onClick={() => setLocale("eu")}
                  disabled={savingLocale}
                >
                  {t("settings.eu")}
                </Button>
              </div>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                El idioma del contenido escrito por tu nutricionista depende del idioma que os resulte mas comodo.
              </p>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card>
              <div className="text-sm font-semibold text-[var(--text)]">Preferencias</div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[var(--text-muted)]">Hora recordatorio</label>
                  <select
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-[var(--text)]"
                    value={reminderHour}
                    onChange={(e) => setReminderHour(e.target.value)}
                  >
                    {Array.from({ length: 24 }, (_, i) => i).map((hour) => {
                      const formatted = `${String(hour).padStart(2, "0")}:00`;
                      return (
                        <option key={formatted} value={formatted}>
                          {formatted}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <label className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={digestiveNudges}
                    onChange={(e) => setDigestiveNudges(e.target.checked)}
                  />
                  Nudges digestivos
                </label>
              </div>
              <div className="mt-3">
                <Button variant="secondary" onClick={savePreferences} disabled={savingPreferences}>
                  Guardar preferencias
                </Button>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card>
              <div className="text-sm font-semibold text-[var(--text)]">Tus datos</div>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Descarga tus registros en CSV para compartirlos o archivarlos.
              </p>
              <div className="mt-3">
                <Button variant="secondary" onClick={exportDataCsv} disabled={exporting}>
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </Button>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card>
              <div className="text-sm font-semibold text-[var(--text)]">Privacidad</div>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Esta app no sustituye una consulta medica. Si tienes sintomas agudos, consulta con un profesional sanitario.
              </p>
            </Card>
          </motion.div>

          {status ? (
            <motion.div variants={item}>
              <Card className="border-[var(--accent)]/30 bg-[var(--accent-soft)]/50 py-3">
                <p className="text-sm text-[var(--text)]">{status}</p>
              </Card>
            </motion.div>
          ) : null}

          {error ? (
            <motion.div variants={item}>
              <Card className="border-[var(--danger)]/30 bg-red-50 py-3">
                <p className="text-sm text-[var(--danger)]">{error}</p>
              </Card>
            </motion.div>
          ) : null}

          <motion.div variants={item}>
            <Button variant="danger" onClick={signOut}>
              {t("common.signOut")}
            </Button>
          </motion.div>
        </motion.main>
      </div>
    </div>
  );
}

