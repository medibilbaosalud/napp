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

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = sanitizeNext(search.get("next"));
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  React.useEffect(() => {
    trackEvent({
      schemaVersion: 2,
      eventName: "auth_view_login",
      source: "web",
      context: { next },
    });
  }, [next]);

  React.useEffect(() => {
    const oauthError = search.get("oauth_error");
    if (!oauthError) return;
    const mapped =
      oauthError === "missing_code"
        ? "No se recibio codigo OAuth. Intenta de nuevo."
        : oauthError === "exchange_failed" || oauthError === "exchange_exception"
          ? "No se pudo completar el acceso con Google. Reintenta."
          : `Error OAuth: ${oauthError}`;
    setError(mapped);
    trackEvent({
      schemaVersion: 2,
      eventName: "auth_oauth_error",
      source: "web",
      context: { code: oauthError, place: "login_redirect" },
    });
  }, [search]);

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push(next);
      router.refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error iniciando sesion";
      setError(message);
      captureClientError(e, {
        component: "LoginPage.onSubmit",
        severity: "error",
        context: { next },
      });
    }
  }

  return (
    <AuthShell
      title="Bienvenido"
      subtitle="Accede en segundos y continua con tu plan del dia."
    >
      <GoogleAuthButton nextPath={next} mode="signin" />

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
          <Input
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            {...form.register("email")}
          />
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
            autoComplete="current-password"
            placeholder="Minimo 8 caracteres"
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p className="text-xs text-[var(--danger)]">
              {form.formState.errors.password.message}
            </p>
          ) : null}
        </div>
        {error ? (
          <p className="rounded-[var(--radius-sm)] border border-[var(--danger)]/30 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}
        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
          Entrar
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm">
        <Link className="text-[var(--text-muted)] hover:text-[var(--text)]" href="/forgot-password">
          Olvidaste tu contrasena?
        </Link>
        <Link className="font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]" href="/signup">
          Crear cuenta
        </Link>
      </div>
    </AuthShell>
  );
}
