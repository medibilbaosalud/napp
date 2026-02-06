"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const schema = z.object({
  email: z.string().email(),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    const origin = window.location.origin;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      values.email,
      { redirectTo: `${origin}/auth/callback?next=/reset-password` },
    );
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell
      title="Restablecer contraseña"
      subtitle="Te enviaremos un email con un enlace para crear una nueva contraseña."
    >
      {sent ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Si ese email existe, recibirás un enlace en unos minutos.
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Email</label>
            <Input type="email" autoComplete="email" {...form.register("email")} />
          </div>
          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
            Enviar enlace
          </Button>
        </form>
      )}
      <div className="mt-6 text-sm">
        <Link className="text-slate-600 hover:text-slate-900" href="/login">
          Volver a iniciar sesión
        </Link>
      </div>
    </AuthShell>
  );
}
