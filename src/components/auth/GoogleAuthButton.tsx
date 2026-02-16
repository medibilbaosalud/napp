"use client";

import * as React from "react";
import { Chrome } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { trackEvent } from "@/lib/telemetry/client";
import { captureClientError } from "@/lib/diagnostics/client";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

function normalizeNext(nextPath?: string) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/app";
  }
  return nextPath;
}

function mapOAuthErrorMessage(code?: string, fallback?: string) {
  if (!code) return fallback ?? "No se pudo iniciar Google OAuth.";
  if (code.includes("popup_closed")) return "Has cerrado la ventana antes de completar el acceso.";
  if (code.includes("access_denied")) return "Acceso denegado. Prueba con otra cuenta de Google.";
  if (code.includes("invalid_request")) return "Configuracion OAuth invalida. Contacta soporte.";
  return fallback ?? "No se pudo iniciar Google OAuth.";
}

export function GoogleAuthButton({
  nextPath,
  mode = "signin",
  className,
}: {
  nextPath?: string;
  mode?: "signin" | "signup";
  className?: string;
}) {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function signInWithGoogle() {
    setError(null);
    setBusy(true);

    try {
      const safeNext = normalizeNext(nextPath);
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
      trackEvent({
        schemaVersion: 2,
        eventName: "auth_oauth_start",
        source: "web",
        context: { provider: "google", mode, next: safeNext },
      });

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (oauthError) {
        const humanError = mapOAuthErrorMessage(oauthError.code, oauthError.message);
        setError(humanError);
        trackEvent({
          schemaVersion: 2,
          eventName: "auth_oauth_error",
          source: "web",
          context: {
            provider: "google",
            mode,
            code: oauthError.code ?? "unknown",
            message: oauthError.message ?? "unknown",
          },
        });
        captureClientError(new Error(oauthError.message), {
          component: "GoogleAuthButton.signInWithOAuth",
          errorCode: oauthError.code ?? "oauth_error",
          severity: "error",
          context: { provider: "google", mode, redirectTo },
        });
        return;
      }

      trackEvent({
        schemaVersion: 2,
        eventName: "auth_oauth_success",
        source: "web",
        context: { provider: "google", mode, next: safeNext },
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error no esperado iniciando OAuth";
      setError(message);
      captureClientError(e, {
        component: "GoogleAuthButton.signInWithGoogle",
        severity: "fatal",
        context: { provider: "google", mode },
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Button
        className="w-full border border-[var(--line)] bg-white text-[var(--text)] hover:bg-[var(--surface-soft)]"
        variant="secondary"
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
      >
        <Chrome className="mr-2 h-4 w-4" />
        {mode === "signin" ? "Entrar con Google" : "Crear cuenta con Google"}
      </Button>
      {error ? (
        <p className="rounded-[var(--radius-sm)] border border-[var(--danger)]/30 bg-red-50 px-3 py-2 text-xs text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
