"use client";

import * as React from "react";
import Image from "next/image";
import { Copy, QrCode } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Topbar } from "@/components/ui/Topbar";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function NutriInvitePage() {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = React.useState("");
  const [inviteUrl, setInviteUrl] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userData.user.id)
        .maybeSingle<{ email: string }>();

      const nutriEmail = profile?.email ?? "";
      setEmail(nutriEmail);
      const origin = window.location.origin;
      setInviteUrl(`${origin}/signup?next=/app/patient/onboarding&nutri=${encodeURIComponent(nutriEmail)}`);
    })();
  }, [supabase]);

  const qrUrl = inviteUrl
    ? `https://quickchart.io/qr?size=240&text=${encodeURIComponent(inviteUrl)}`
    : "";

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="pb-8">
      <Topbar title="Invitación clínica" subtitle="Comparte enlace o QR para activar pacientes" />
      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        <Card className="space-y-3">
          <div className="text-sm font-semibold text-[var(--text)]">Email nutricionista</div>
          <Input value={email} readOnly />
        </Card>

        <Card className="space-y-3">
          <div className="text-sm font-semibold text-[var(--text)]">Enlace de invitación</div>
          <Input value={inviteUrl} readOnly />
          <Button onClick={copyInvite}>
            <Copy className="h-4 w-4" />
            {copied ? "Copiado" : "Copiar enlace"}
          </Button>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
            <QrCode className="h-4 w-4" />
            QR de invitación
          </div>
          {qrUrl ? (
            <Image
              src={qrUrl}
              alt="QR invitacion"
              width={240}
              height={240}
              unoptimized={false}
              className="mx-auto rounded-[var(--radius-sm)] border border-[var(--line)]"
            />
          ) : null}
          <p className="text-xs text-[var(--text-muted)]">Escanea para abrir registro con nutricionista precargado.</p>
        </Card>
      </div>
    </div>
  );
}
