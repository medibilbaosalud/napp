"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { trackEvent } from "@/lib/telemetry/client";

export function NpsPrompt({
  context,
  onSubmitted,
}: {
  context: Record<string, unknown>;
  onSubmitted?: () => void;
}) {
  const [score, setScore] = React.useState<number | null>(null);
  const [comment, setComment] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    if (score == null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback/nps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ score, comment, context }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "No se pudo enviar");
        return;
      }
      setSent(true);
      trackEvent({ eventName: "submit_nps", context: { score, ...context } });
      onSubmitted?.();
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Card className="border-[var(--accent-soft)] bg-[var(--accent-soft)]/30">
        <p className="text-sm text-[var(--text)]">Gracias por tu feedback. Nos ayuda a mejorar cada semana.</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div>
        <div className="text-sm font-semibold text-[var(--text)]">¿Cómo valorarías la app hoy?</div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">0 nada probable - 10 muy probable recomendarla.</p>
      </div>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
        {Array.from({ length: 11 }, (_, idx) => idx).map((value) => (
          <button
            key={value}
            className={`rounded-[var(--radius-sm)] border px-2 py-2 text-xs font-semibold transition ${
              score === value
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : "border-[var(--line)] bg-white text-[var(--text-muted)]"
            }`}
            onClick={() => setScore(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <Input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comentario opcional"
      />
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      <Button onClick={submit} disabled={busy || score == null}>
        Enviar valoración
      </Button>
    </Card>
  );
}
