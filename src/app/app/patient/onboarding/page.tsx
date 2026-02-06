"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      goal: "Mejorar hábitos y adherencia",
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
          ? "Ese email no está autorizado como nutricionista. Revisa el email o contacta con la clínica."
          : linkError.message,
      );
      return;
    }

    router.push("/app/patient/today");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">
          Empezamos
        </h1>
        <p className="text-sm text-slate-600">
          Esta app acompaña tu consulta. No sustituye una consulta médica.
        </p>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Card className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">
              Datos básicos
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Nombre (opcional)
              </label>
              <Input {...form.register("fullName")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Objetivo principal
              </label>
              <Input {...form.register("goal")} />
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">
              Nivel de seguimiento
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["simple", "photo", "detail"] as const).map((level) => (
                <label
                  key={level}
                  className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-sm ${
                    trackingLevel === level
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    value={level}
                    {...form.register("trackingLevel")}
                  />
                  {level === "simple"
                    ? "Simple"
                    : level === "photo"
                      ? "Foto"
                      : "Detallado"}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" {...form.register("digestiveEnabled")} />
              Activar diario digestivo (opcional)
            </label>
          </Card>

          <Card className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">
              Vincular con tu nutricionista
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Email del nutricionista
              </label>
              <Input type="email" autoComplete="email" {...form.register("nutriEmail")} />
              {form.formState.errors.nutriEmail ? (
                <p className="text-xs text-red-600">
                  {form.formState.errors.nutriEmail.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Nota (opcional)
              </label>
              <Input {...form.register("patientNote")} placeholder="Ej: horarios, trabajo a turnos..." />
            </div>
            <p className="text-xs text-slate-500">
              Tu solicitud quedará pendiente hasta que el nutricionista la acepte.
            </p>
          </Card>

          <Card className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">
              Consentimiento
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" {...form.register("consent")} />
              <span>
                Acepto el uso de mis datos para seguimiento nutricional y entiendo
                que la app no sustituye consulta médica.
              </span>
            </label>
            {form.formState.errors.consent ? (
              <p className="text-xs text-red-600">Debes aceptar para continuar.</p>
            ) : null}
          </Card>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
            Continuar
          </Button>
        </form>
      </div>
    </div>
  );
}
