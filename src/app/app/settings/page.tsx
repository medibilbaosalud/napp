"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { LOCALE_COOKIE } from "@/lib/supabase/constants";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Topbar } from "@/components/ui/Topbar";
import { useT } from "@/components/i18n/LocaleProvider";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const { locale, t } = useT();
  const [saving, setSaving] = React.useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function setLocale(nextLocale: "es" | "eu") {
    setSaving(true);
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      document.cookie = `${LOCALE_COOKIE}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 pb-24">
      <Topbar title={t("settings.title")} />
      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        <Card>
          <div className="text-sm font-semibold text-slate-900">
            {t("settings.language")}
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              variant={locale === "es" ? "primary" : "secondary"}
              onClick={() => setLocale("es")}
              disabled={saving}
            >
              {t("settings.es")}
            </Button>
            <Button
              variant={locale === "eu" ? "primary" : "secondary"}
              onClick={() => setLocale("eu")}
              disabled={saving}
            >
              {t("settings.eu")}
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            El idioma del contenido escrito por tu nutricionista (planes y
            mensajes) depende de lo que os sea más cómodo.
          </p>
        </Card>

        <Card>
          <div className="text-sm font-semibold text-slate-900">Privacidad</div>
          <p className="mt-2 text-sm text-slate-600">
            Esta app no sustituye una consulta médica. Puedes borrar registros y
            fotos desde el historial (MVP: en pantallas de registro).
          </p>
        </Card>

        <Button variant="danger" onClick={signOut}>
          {t("common.signOut")}
        </Button>
      </main>
    </div>
  );
}
