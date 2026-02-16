"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { trackEvent } from "@/lib/telemetry/client";
import { captureClientError } from "@/lib/diagnostics/client";
import { AuthShell } from "@/components/layout/AuthShell";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

function sanitizeNext(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/app";
  }
  return nextPath;
}

export default function SignupPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = sanitizeNext(search.get("next"));
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  React.useEffect(() => {
    trackEvent({
      schemaVersion: 2,
      eventName: "auth_view_signup",
      source: "web",
      context: { next },
    });
  }, [next]);

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const origin = window.location.origin;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        router.push(next);
        router.refresh();
        return;
      }

      setSent(true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error creando cuenta";
      setError(message);
      captureClientError(e, {
        component: "SignupPage.onSubmit",
        severity: "error",
        context: { next },
      });
    }
  }

  return (
    <AuthShell
      title="Crear cuenta"
      subtitle="Empieza con Google o usa email y confirma en un clic."
    >
      {sent ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--accent)]/25 bg-[var(--accent-soft)]/45 p-4 text-sm text-[var(--text)]">
          Revisa tu email para confirmar la cuenta y completar el acceso.
          <div className="mt-4">
            <Link
              className="font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]"
              href="/login"
            >
              Ir a iniciar sesion
            </Link>
          </div>
        </div>
      ) : (
        <>
          <GoogleAuthButton nextPath={next} mode="signup" />

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--line)]" />
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              o con email
            </span>
            <div className="h-px flex-1 bg-[var(--line)]" />
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text)]">Email</label>
              <Input type="email" autoComplete="email" placeholder="tu@email.com" {...form.register("email")} />
              {form.formState.errors.email ? (
                <p className="text-xs text-[var(--danger)]">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text)]">Contrasena</label>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Minimo 8 caracteres"
                {...form.register("password")}
              />
              {form.formState.errors.password ? (
                <p className="text-xs text-[var(--danger)]">
                  {form.formState.errors.password.message}
                </p>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">Minimo 8 caracteres.</p>
              )}
            </div>
            {error ? (
              <p className="rounded-[var(--radius-sm)] border border-[var(--danger)]/30 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
                {error}
              </p>
            ) : null}
            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
              Crear cuenta
            </Button>
          </form>
        </>
      )}

      <div className="mt-6 text-sm text-[var(--text-muted)]">
        Ya tienes cuenta?{" "}
        <Link className="font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]" href="/login">
          Inicia sesion
        </Link>
      </div>
    </AuthShell>
  );
}
