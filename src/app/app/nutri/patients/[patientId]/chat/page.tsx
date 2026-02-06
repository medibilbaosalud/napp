"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Topbar } from "@/components/ui/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils/cn";

type ThreadRow = { id: string; patient_id: string; nutri_id: string };
type MessageRow = { id: string; sender_id: string; body: string; created_at: string };

const quickReplies = [
  "Gracias por enviarlo. Esta semana ajustaremos 2 cosas y vemos cómo responde.",
  "Perfecto. Quédate con una acción mínima diaria; el objetivo es consistencia, no perfección.",
  "Lo he visto. Te propongo un cambio simple para reducir fricción.",
];

export default function NutriChatPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [thread, setThread] = React.useState<ThreadRow | null>(null);
  const [messages, setMessages] = React.useState<MessageRow[]>([]);
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  React.useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      setUserId(userData.user.id);

      const { data: t } = await supabase
        .from("threads")
        .select("id,patient_id,nutri_id")
        .eq("patient_id", patientId)
        .eq("nutri_id", userData.user.id)
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
            setMessages((prev) => [...prev, payload.new as unknown as MessageRow]);
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    })();
  }, [supabase, patientId]);

  async function send() {
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

  return (
    <div className="pb-8">
      <Topbar title="Chat" />
      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        <Card>
          <Link
            href={`/app/nutri/patients/${patientId}`}
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            ← Paciente
          </Link>
        </Card>

        {!thread ? (
          <Card>
            <p className="text-sm text-slate-600">
              No hay thread activo (¿vinculación pendiente?).
            </p>
          </Card>
        ) : (
          <Card>
            <div className="text-sm font-semibold text-slate-900">Mensajes</div>
            <div className="mt-3 max-h-[52vh] space-y-2 overflow-auto rounded-xl bg-slate-50 p-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    m.sender_id === userId
                      ? "ml-auto bg-emerald-700 text-white"
                      : "bg-white text-slate-900 border border-slate-200",
                  )}
                >
                  {m.body}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {quickReplies.map((q) => (
                <button
                  key={q}
                  onClick={() => setText(q)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  Respuesta rápida
                </button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe…" />
              <Button onClick={send}>Enviar</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
