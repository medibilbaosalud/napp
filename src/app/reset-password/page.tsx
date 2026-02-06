"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const schema = z
  .object({
    password: z.string().min(8),
    confirm: z.string().min(8),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Las contraseñas no coinciden.",
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [error, setError] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
    });
  }, [supabase]);

  async function onSubmit(values: FormValues) {
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({
      password: values.password,
    });
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <AuthShell
      title="Crear nueva contraseña"
      subtitle="Elige una contraseña segura (mínimo 8 caracteres)."
    >
      {!ready ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          Abre el enlace de recuperación desde tu email para continuar.
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Nueva contraseña
            </label>
            <Input type="password" autoComplete="new-password" {...form.register("password")} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Repite la contraseña
            </label>
            <Input type="password" autoComplete="new-password" {...form.register("confirm")} />
            {form.formState.errors.confirm ? (
              <p className="text-xs text-red-600">
                {form.formState.errors.confirm.message}
              </p>
            ) : null}
          </div>
          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
            Guardar contraseña
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
