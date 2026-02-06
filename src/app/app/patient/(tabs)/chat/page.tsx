"use client";

import * as React from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Topbar } from "@/components/ui/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils/cn";

type ThreadRow = { id: string; patient_id: string; nutri_id: string };
type MessageRow = { id: string; sender_id: string; body: string; created_at: string };

export default function PatientChatPage() {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [thread, setThread] = React.useState<ThreadRow | null>(null);
  const [messages, setMessages] = React.useState<MessageRow[]>([]);
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<"nutri" | "assistant">("nutri");
  const [assistantMsgs, setAssistantMsgs] = React.useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, assistantMsgs]);

  React.useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      setUserId(userData.user.id);

      const { data: ct } = await supabase
        .from("care_teams")
        .select("nutri_id")
        .eq("patient_id", userData.user.id)
        .maybeSingle<{ nutri_id: string }>();
      if (!ct) {
        setThread(null);
        return;
      }

      const { data: t } = await supabase
        .from("threads")
        .select("id,patient_id,nutri_id")
        .eq("patient_id", userData.user.id)
        .eq("nutri_id", ct.nutri_id)
        .maybeSingle<ThreadRow>();
      if (!t) {
        setThread(null);
        return;
      }
      setThread(t);

      const { data: msgs } = await supabase
        .from("messages")
        .select("id,sender_id,body,created_at")
        .eq("thread_id", t.id)
        .order("created_at", { ascending: true })
        .returns<MessageRow[]>();
      setMessages(msgs ?? []);

      const channel = supabase
        .channel(`thread:${t.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${t.id}` },
          (payload) => {
            const row = payload.new as unknown as MessageRow;
            setMessages((prev) => [...prev, row]);
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    })();
  }, [supabase]);

  async function sendToNutri() {
    setError(null);
    if (!thread || !userId) return;
    const body = text.trim();
    if (!body) return;
    setText("");
    const { error: insertError } = await supabase.from("messages").insert({
      thread_id: thread.id,
      sender_id: userId,
      body,
    });
    if (insertError) setError(insertError.message);
  }

  async function sendToAssistant() {
    setError(null);
    const body = text.trim();
    if (!body) return;
    setText("");
    setAssistantMsgs((prev) => [...prev, { role: "user", content: body }]);
    try {
      const res = await fetch("/api/ai/plan-assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: body }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        answer?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data?.error ?? "Error");
        return;
      }
      setAssistantMsgs((prev) => [
        ...prev,
        { role: "assistant", content: data?.answer ?? "No tengo respuesta." },
      ]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  const canChat = Boolean(thread);

  return (
    <div className="pb-24">
      <Topbar title="Chat / Revisión" />
      <div className="px-4 py-4 space-y-4">
        {!canChat ? (
          <Card>
            <div className="text-sm font-semibold text-slate-900">Sin chat todavía</div>
            <p className="mt-1 text-sm text-slate-600">
              El chat se activa cuando tu nutricionista acepta la vinculación.
            </p>
          </Card>
        ) : (
          <>
            <Card className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Modo</div>
                <p className="mt-1 text-xs text-slate-500">
                  Respuestas del nutri: aprox. 24–48h laborables.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm",
                    mode === "nutri"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700",
                  )}
                  onClick={() => setMode("nutri")}
                >
                  Nutricionista
                </button>
                <button
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm",
                    mode === "assistant"
                      ? "border-emerald-700 bg-emerald-700 text-white"
                      : "border-slate-200 bg-white text-slate-700",
                  )}
                  onClick={() => setMode("assistant")}
                >
                  Asistente
                </button>
              </div>
            </Card>

            {mode === "assistant" ? (
              <Card className="border-emerald-200 bg-emerald-50">
                <p className="text-sm text-emerald-900">
                  El asistente responde solo sobre tu plan y contenidos de la app.
                  No sustituye a tu nutricionista ni a una consulta médica.
                </p>
              </Card>
            ) : null}

            <Card>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Mensajes</div>
                <Link
                  href="/app/patient/review"
                  className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                >
                  Enviar revisión semanal
                </Link>
              </div>
              <div className="mt-3 max-h-[48vh] space-y-2 overflow-auto rounded-xl bg-slate-50 p-3">
                {mode === "nutri"
                  ? messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                          m.sender_id === userId
                            ? "ml-auto bg-slate-900 text-white"
                            : "bg-white text-slate-900 border border-slate-200",
                        )}
                      >
                        {m.body}
                      </div>
                    ))
                  : assistantMsgs.map((m, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                          m.role === "user"
                            ? "ml-auto bg-slate-900 text-white"
                            : "bg-white text-slate-900 border border-emerald-200",
                        )}
                      >
                        {m.content}
                      </div>
                    ))}
                <div ref={bottomRef} />
              </div>

              {error ? (
                <p className="mt-3 text-sm text-red-700">{error}</p>
              ) : null}

              <div className="mt-3 flex gap-2">
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    mode === "assistant" ? "Pregunta sobre tu plan…" : "Escribe un mensaje…"
                  }
                />
                <Button onClick={mode === "assistant" ? sendToAssistant : sendToNutri}>
                  Enviar
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
