"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, MessageSquareHeart, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Topbar } from "@/components/ui/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils/cn";

type ThreadRow = { id: string; patient_id: string; nutri_id: string };
type MessageRow = { id: string; sender_id: string; body: string; created_at: string };

const container = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.05, delayChildren: 0.03 },
  },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function PatientChatPage() {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [thread, setThread] = React.useState<ThreadRow | null>(null);
  const [messages, setMessages] = React.useState<MessageRow[]>([]);
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<"nutri" | "assistant">("nutri");
  const [assistantMsgs, setAssistantMsgs] = React.useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
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
      const data = (await res.json().catch(() => ({}))) as { answer?: string; error?: string };
      if (!res.ok) {
        setError(data?.error ?? "Error");
        return;
      }
      setAssistantMsgs((prev) => [...prev, { role: "assistant", content: data?.answer ?? "No tengo respuesta." }]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  const canChat = Boolean(thread);

  return (
    <div className="pb-28">
      <Topbar title="Chat / Revision" subtitle="Asincrono con tu nutri y soporte IA" />

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-4 px-4 py-4">
        {!canChat ? (
          <motion.div variants={item}>
            <Card>
              <div className="text-sm font-semibold text-[var(--text)]">Sin chat todavia</div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                El chat se activa cuando tu nutricionista acepta la vinculacion.
              </p>
            </Card>
          </motion.div>
        ) : (
          <>
            <motion.div variants={item}>
              <Card className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">Modo de respuesta</div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Nutri: 24-48h laborables. IA: instantaneo sobre tu plan.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    className={cn(
                      "rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-medium",
                      mode === "nutri"
                        ? "border-[var(--text)] bg-[var(--text)] text-white"
                        : "border-[var(--line)] bg-white text-[var(--text-muted)]",
                    )}
                    onClick={() => setMode("nutri")}
                  >
                    <MessageSquareHeart className="mr-1 inline-block h-4 w-4" />
                    Nutri
                  </button>
                  <button
                    className={cn(
                      "rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-medium",
                      mode === "assistant"
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--line)] bg-white text-[var(--text-muted)]",
                    )}
                    onClick={() => setMode("assistant")}
                  >
                    <Bot className="mr-1 inline-block h-4 w-4" />
                    IA
                  </button>
                </div>
              </Card>
            </motion.div>

            <AnimatePresence>
              {mode === "assistant" ? (
                <motion.div variants={item} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Card className="border-[var(--accent)]/20 bg-[var(--accent-soft)]/45">
                    <p className="text-sm text-[var(--text)]">
                      El asistente responde solo sobre tu plan y contenidos de la app. No sustituye a tu nutricionista ni a una consulta medica.
                    </p>
                  </Card>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <motion.div variants={item}>
              <Card>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-[var(--text)]">Mensajes</div>
                  <Link href="/app/patient/review" className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]">
                    Enviar revision semanal
                  </Link>
                </div>

                <div className="mt-3 max-h-[48vh] space-y-2 overflow-auto rounded-[var(--radius-sm)] bg-[var(--surface-soft)] p-3">
                  {(mode === "nutri" ? messages.map((m) => ({ id: m.id, own: m.sender_id === userId, content: m.body })) : assistantMsgs.map((m, idx) => ({ id: String(idx), own: m.role === "user", content: m.content }))).map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "max-w-[85%] rounded-2xl border px-3 py-2 text-sm",
                        msg.own
                          ? "ml-auto border-[var(--text)] bg-[var(--text)] text-white"
                          : mode === "assistant"
                            ? "border-[var(--accent)]/30 bg-white text-[var(--text)]"
                            : "border-[var(--line)] bg-white text-[var(--text)]",
                      )}
                    >
                      {msg.content}
                    </motion.div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}

                <div className="mt-3 flex gap-2">
                  <Input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={mode === "assistant" ? "Pregunta sobre tu plan..." : "Escribe un mensaje..."}
                  />
                  <Button onClick={mode === "assistant" ? sendToAssistant : sendToNutri}>
                    <Sparkles className="h-4 w-4" />
                    Enviar
                  </Button>
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
}
