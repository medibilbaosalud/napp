"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Topbar } from "@/components/ui/Topbar";
import { Card } from "@/components/ui/Card";

type Summary = {
  checkins7d: number;
  photos7d: number;
  pendingReview: boolean;
  lastMessageAt: string | null;
};

export default function NutriPatientHomePage() {
  const { patientId } = useParams<{ patientId: string }>();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [name, setName] = React.useState<string>(patientId);
  const [summary, setSummary] = React.useState<Summary>({
    checkins7d: 0,
    photos7d: 0,
    pendingReview: false,
    lastMessageAt: null,
  });

  React.useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name,email")
        .eq("id", patientId)
        .maybeSingle<{ full_name: string | null; email: string }>();
      if (data) setName(data.full_name || data.email || patientId);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [{ count: checkins }, { count: photos }, { data: review }, { data: thread }] = await Promise.all([
        supabase
          .from("logs")
          .select("id", { count: "exact", head: true })
          .eq("patient_id", patientId)
          .eq("type", "checkin")
          .gte("logged_at", sevenDaysAgo.toISOString()),
        supabase
          .from("logs")
          .select("id", { count: "exact", head: true })
          .eq("patient_id", patientId)
          .eq("type", "photo")
          .gte("logged_at", sevenDaysAgo.toISOString()),
        supabase
          .from("weekly_reviews")
          .select("id")
          .eq("patient_id", patientId)
          .is("responded_at", null)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("threads")
          .select("id")
          .eq("patient_id", patientId)
          .limit(1)
          .maybeSingle(),
      ]);

      let lastMessageAt: string | null = null;
      if (thread?.id) {
        const { data: msg } = await supabase
          .from("messages")
          .select("created_at")
          .eq("thread_id", thread.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<{ created_at: string }>();
        lastMessageAt = msg?.created_at ?? null;
      }

      setSummary({
        checkins7d: checkins ?? 0,
        photos7d: photos ?? 0,
        pendingReview: Boolean(review),
        lastMessageAt,
      });
    })();
  }, [supabase, patientId]);

  return (
    <div className="pb-8">
      <Topbar title="Ficha paciente" subtitle="Resumen operativo y accesos clinicos" />
      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        <Card>
          <Link href="/app/nutri/patients" className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]">
            {"<-"} Volver al board
          </Link>
          <div className="mt-2 text-xl font-semibold text-[var(--text)]">{name}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-[var(--radius-sm)] bg-[var(--surface-soft)] px-3 py-2">
              <div className="text-xs text-[var(--text-muted)]">Check-ins 7d</div>
              <div className="font-semibold text-[var(--text)]">{summary.checkins7d}</div>
            </div>
            <div className="rounded-[var(--radius-sm)] bg-[var(--surface-soft)] px-3 py-2">
              <div className="text-xs text-[var(--text-muted)]">Fotos 7d</div>
              <div className="font-semibold text-[var(--text)]">{summary.photos7d}</div>
            </div>
            <div className="rounded-[var(--radius-sm)] bg-[var(--surface-soft)] px-3 py-2">
              <div className="text-xs text-[var(--text-muted)]">Revision pendiente</div>
              <div className="font-semibold text-[var(--text)]">{summary.pendingReview ? "Si" : "No"}</div>
            </div>
            <div className="rounded-[var(--radius-sm)] bg-[var(--surface-soft)] px-3 py-2">
              <div className="text-xs text-[var(--text-muted)]">Ultimo mensaje</div>
              <div className="font-semibold text-[var(--text)]">{summary.lastMessageAt ? new Date(summary.lastMessageAt).toLocaleDateString() : "-"}</div>
            </div>
          </div>
        </Card>

        <div className="grid gap-3">
          <Link href={`/app/nutri/patients/${patientId}/plan`}>
            <Card className="hover:bg-[var(--surface-soft)]">
              <div className="text-sm font-semibold text-[var(--text)]">Plan visual</div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Editar bloques, validar y publicar.</p>
            </Card>
          </Link>
          <Link href={`/app/nutri/patients/${patientId}/logs`}>
            <Card className="hover:bg-[var(--surface-soft)]">
              <div className="text-sm font-semibold text-[var(--text)]">Timeline de registros</div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Check-ins, fotos y contexto reciente.</p>
            </Card>
          </Link>
          <Link href={`/app/nutri/patients/${patientId}/reviews`}>
            <Card className="hover:bg-[var(--surface-soft)]">
              <div className="text-sm font-semibold text-[var(--text)]">Revisiones</div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Responder con cambios concretos + objetivo.</p>
            </Card>
          </Link>
          <Link href={`/app/nutri/patients/${patientId}/chat`}>
            <Card className="hover:bg-[var(--surface-soft)]">
              <div className="text-sm font-semibold text-[var(--text)]">Chat</div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Mensajeria asincrona con respuestas rapidas.</p>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}

