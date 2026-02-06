"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    const origin = window.location.origin;
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      router.push("/app");
      router.refresh();
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell
      title="Crear cuenta"
      subtitle="Te enviaremos un email para confirmar el acceso."
    >
      {sent ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Revisa tu email para confirmar tu cuenta. Luego vuelve aquí e inicia
          sesión.
          <div className="mt-4">
            <Link
              className="font-medium text-emerald-700 hover:text-emerald-800"
              href="/login"
            >
              Ir a iniciar sesión
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Email</label>
            <Input type="email" autoComplete="email" {...form.register("email")} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <Input
              type="password"
              autoComplete="new-password"
              {...form.register("password")}
            />
            <p className="text-xs text-slate-500">
              Mínimo 8 caracteres.
            </p>
          </div>
          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
            Crear cuenta
          </Button>
        </form>
      )}

      <div className="mt-6 text-sm text-slate-600">
        ¿Ya tienes cuenta?{" "}
        <Link className="font-medium text-emerald-700 hover:text-emerald-800" href="/login">
          Inicia sesión
        </Link>
      </div>
    </AuthShell>
  );
}
