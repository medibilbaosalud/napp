"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Sparkles } from "lucide-react";
import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getOnboardingState, saveOnboardingStep } from "@/lib/services/onboarding";
import { trackEvent } from "@/lib/telemetry/client";
import { captureClientError } from "@/lib/diagnostics/client";
import type { OnboardingStepKey } from "@/lib/types/engagement";
import { Atmosphere } from "@/components/ui/Atmosphere";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils/cn";

const schema = z.object({
  fullName: z.string().min(2).max(80).optional().or(z.literal("")),
  goal: z.string().min(2).max(120),
  trackingLevel: z.enum(["simple", "photo", "detail"]),
  digestiveEnabled: z.boolean(),
  nutriEmail: z.string().email(),
  patientNote: z.string().max(240).optional().or(z.literal("")),
  consent: z.literal(true),
});

type FormValues = z.infer<typeof schema>;

const steps: Array<{ key: OnboardingStepKey; title: string }> = [
  { key: "profile", title: "Perfil" },
  { key: "tracking", title: "Seguimiento" },
  { key: "link", title: "Vinculacion" },
  { key: "consent", title: "Consentimiento" },
];

const container = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.05, delayChildren: 0.03 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32 } },
};

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [error, setError] = React.useState<string | null>(null);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [loadingState, setLoadingState] = React.useState(true);
  const [savingStep, setSavingStep] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      goal: "Mejorar habitos y adherencia",
      trackingLevel: "simple",
      digestiveEnabled: false,
      nutriEmail: "",
      patientNote: "",
      consent: true,
    },
  });

  const trackingLevel = useWatch({
    control: form.control,
    name: "trackingLevel",
  });

  React.useEffect(() => {
    (async () => {
      try {
        const state = await getOnboardingState();
        const latest = state.latestStep;
        const byKey = new Map(state.steps.map((s) => [s.step_key, s]));

        const profileData = byKey.get("profile")?.step_data ?? {};
        const trackingData = byKey.get("tracking")?.step_data ?? {};
        const linkData = byKey.get("link")?.step_data ?? {};
        const consentData = byKey.get("consent")?.step_data ?? {};

        form.reset({
          fullName: String(profileData.fullName ?? ""),
          goal: String(profileData.goal ?? "Mejorar habitos y adherencia"),
          trackingLevel:
            trackingData.trackingLevel === "photo" || trackingData.trackingLevel === "detail"
              ? trackingData.trackingLevel
              : "simple",
          digestiveEnabled: Boolean(trackingData.digestiveEnabled ?? false),
          nutriEmail: String(linkData.nutriEmail ?? ""),
          patientNote: String(linkData.patientNote ?? ""),
          consent: Boolean(consentData.consent ?? true) as true,
        });

        const latestIndex = steps.findIndex((s) => s.key === latest);
        if (latestIndex >= 0) setStepIndex(Math.min(latestIndex, steps.length - 1));
      } catch (e: unknown) {
        captureClientError(e, {
          component: "OnboardingPage.loadState",
          severity: "warning",
        });
      } finally {
        setLoadingState(false);
      }
    })();
  }, [form]);

  React.useEffect(() => {
    const nutri = searchParams.get("nutri");
    if (!nutri) return;
    if (!form.getValues("nutriEmail")) {
      form.setValue("nutriEmail", nutri, { shouldValidate: true });
    }
  }, [form, searchParams]);

  async function persistCurrentStep(currentKey: OnboardingStepKey) {
    const values = form.getValues();
    let stepData: Record<string, unknown> = {};

    if (currentKey === "profile") {
      stepData = { fullName: values.fullName, goal: values.goal };
    } else if (currentKey === "tracking") {
      stepData = {
        trackingLevel: values.trackingLevel,
        digestiveEnabled: values.digestiveEnabled,
      };
    } else if (currentKey === "link") {
      stepData = { nutriEmail: values.nutriEmail, patientNote: values.patientNote };
    } else if (currentKey === "consent") {
      stepData = { consent: values.consent };
    }

    setSavingStep(true);
    try {
      await saveOnboardingStep({
        stepKey: currentKey,
        stepData,
        completed: true,
        sourceChannel: "direct",
      });
      trackEvent({
        schemaVersion: 2,
        eventName: "onboarding_step_saved",
        source: "web",
        context: { step: currentKey },
      });
    } finally {
      setSavingStep(false);
    }
  }

  async function onNext() {
    setError(null);
    const key = steps[stepIndex].key;

    if (key === "profile") {
      const ok = await form.trigger(["fullName", "goal"]);
      if (!ok) return;
    }
    if (key === "tracking") {
      const ok = await form.trigger(["trackingLevel", "digestiveEnabled"]);
      if (!ok) return;
    }
    if (key === "link") {
      const ok = await form.trigger(["nutriEmail", "patientNote"]);
      if (!ok) return;
    }
    if (key === "consent") {
      const ok = await form.trigger(["consent"]);
      if (!ok) return;
    }

    try {
      await persistCurrentStep(key);
      setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el paso.");
      captureClientError(e, {
        component: "OnboardingPage.onNext",
        severity: "error",
        context: { step: key },
      });
    }
  }

  async function onSubmit(values: FormValues) {
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push("/login");
      return;
    }

    const now = new Date().toISOString();

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: values.fullName || null })
      .eq("id", userData.user.id);
    if (profileError) {
      setError(profileError.message);
      return;
    }

    const { error: consentError } = await supabase.from("patient_consents").upsert(
      {
        patient_id: userData.user.id,
        consent_version: "v1",
        accepted_at: now,
        disclaimer_seen_at: now,
      },
      { onConflict: "patient_id" },
    );
    if (consentError) {
      setError(consentError.message);
      return;
    }

    const { error: patientError } = await supabase
      .from("patients")
      .update({
        goal: values.goal,
        tracking_level: values.trackingLevel,
        digestive_enabled: values.digestiveEnabled,
        onboarding_completed_at: now,
      })
      .eq("id", userData.user.id);
    if (patientError) {
      setError(patientError.message);
      return;
    }

    const { error: linkError } = await supabase.rpc("request_link", {
      p_nutri_email: values.nutriEmail,
      p_patient_display_name: values.fullName || null,
      p_patient_note: values.patientNote || null,
    });

    if (linkError) {
      setError(
        linkError.message.includes("nutri_not_allowed")
          ? "Ese email no esta autorizado como nutricionista. Revisa el email o contacta con la clinica."
          : linkError.message,
      );
      return;
    }

    await saveOnboardingStep({
      stepKey: "complete",
      stepData: { completedAt: now },
      completed: true,
      sourceChannel: "direct",
    });
    trackEvent({
      schemaVersion: 2,
      eventName: "onboarding_complete",
      source: "web",
      context: { trackingLevel: values.trackingLevel },
    });

    router.push("/app/patient/today");
    router.refresh();
  }

  const progress = ((stepIndex + 1) / steps.length) * 100;

  return (
    <div className="min-h-dvh app-shell px-4 py-6">
      <Atmosphere />
      <motion.div variants={container} initial="hidden" animate="show" className="relative z-10 mx-auto max-w-md space-y-4">
        <motion.div variants={item}>
          <Card className="relative overflow-hidden border-[var(--accent)]/20 bg-[var(--bg-elevated)]/90">
            <motion.div
              className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[var(--accent-soft)]/80"
              animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 7, repeat: Infinity }}
            />
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">Fast Start</p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--text)]">Empezamos</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Configuracion guiada en menos de 90 segundos.
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--accent-soft)]/55">
              <motion.div
                className="h-full rounded-full bg-[var(--accent)]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Paso {stepIndex + 1}/{steps.length}: {steps[stepIndex].title}
            </p>
          </Card>
        </motion.div>

        {loadingState ? (
          <motion.div variants={item}>
            <Card>
              <p className="text-sm text-[var(--text-muted)]">Cargando progreso...</p>
            </Card>
          </motion.div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {stepIndex === 0 ? (
              <motion.div variants={item}>
                <Card className="space-y-3">
                  <div className="text-sm font-semibold text-[var(--text)]">Datos basicos</div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text)]">Nombre (opcional)</label>
                    <Input {...form.register("fullName")} placeholder="Como te llamamos" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text)]">Objetivo principal</label>
                    <Input {...form.register("goal")} />
                  </div>
                </Card>
              </motion.div>
            ) : null}

            {stepIndex === 1 ? (
              <motion.div variants={item}>
                <Card className="space-y-3">
                  <div className="text-sm font-semibold text-[var(--text)]">Nivel de seguimiento</div>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ["simple", "Simple"],
                      ["photo", "Foto"],
                      ["detail", "Detallado"],
                    ] as const).map(([level, label]) => (
                      <label
                        key={level}
                        className={cn(
                          "flex cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-medium",
                          trackingLevel === level
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                            : "border-[var(--line)] bg-white text-[var(--text-muted)]",
                        )}
                      >
                        <input className="sr-only" type="radio" value={level} {...form.register("trackingLevel")} />
                        {label}
                      </label>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                    <input type="checkbox" {...form.register("digestiveEnabled")} />
                    Activar diario digestivo (opcional)
                  </label>
                </Card>
              </motion.div>
            ) : null}

            {stepIndex === 2 ? (
              <motion.div variants={item}>
                <Card className="space-y-3">
                  <div className="text-sm font-semibold text-[var(--text)]">Vincular con tu nutricionista</div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text)]">Email del nutricionista</label>
                    <Input type="email" autoComplete="email" {...form.register("nutriEmail")} placeholder="nutri@clinica.com" />
                    {form.formState.errors.nutriEmail ? (
                      <p className="text-xs text-[var(--danger)]">{form.formState.errors.nutriEmail.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text)]">Nota (opcional)</label>
                    <Input {...form.register("patientNote")} placeholder="Ej: horarios, trabajo a turnos..." />
                  </div>
                </Card>
              </motion.div>
            ) : null}

            {stepIndex === 3 ? (
              <motion.div variants={item}>
                <Card className="space-y-3">
                  <div className="text-sm font-semibold text-[var(--text)]">Consentimiento</div>
                  <label className="flex items-start gap-2 text-sm text-[var(--text)]">
                    <input type="checkbox" {...form.register("consent")} />
                    <span>
                      Acepto el uso de mis datos para seguimiento nutricional y entiendo que la app no sustituye consulta medica.
                    </span>
                  </label>
                  {form.formState.errors.consent ? (
                    <p className="text-xs text-[var(--danger)]">Debes aceptar para continuar.</p>
                  ) : (
                    <div className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[11px] font-medium text-[var(--accent-strong)]">
                      <CheckCircle2 className="h-3 w-3" />
                      Consentimiento preparado
                    </div>
                  )}
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

            <motion.div variants={item} className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={stepIndex === 0 || savingStep}
                onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
              >
                Atras
              </Button>

              {stepIndex < steps.length - 1 ? (
                <Button type="button" onClick={onNext} disabled={savingStep}>
                  <Sparkles className="h-4 w-4" />
                  Siguiente
                </Button>
              ) : (
                <Button type="submit" disabled={form.formState.isSubmitting || savingStep}>
                  <Sparkles className="h-4 w-4" />
                  Finalizar
                </Button>
              )}
            </motion.div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
