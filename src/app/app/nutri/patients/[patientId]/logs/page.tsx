"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Topbar } from "@/components/ui/Topbar";
import { Card } from "@/components/ui/Card";

type LogRow = {
  id: string;
  type: "checkin" | "photo" | "detail";
  adherence: "cumpli" | "a_medias" | "no" | null;
  reason_codes: string[] | null;
  energy: number | null;
  hunger: number | null;
  notes: string | null;
  photo_object_name: string | null;
  logged_at: string;
};

export default function NutriLogsPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = React.useState<Array<LogRow & { photoUrl?: string }>>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      setError(null);
      const { data: logs, error: logsErr } = await supabase
        .from("logs")
        .select("id,type,adherence,reason_codes,energy,hunger,notes,photo_object_name,logged_at")
        .eq("patient_id", patientId)
        .order("logged_at", { ascending: false })
        .limit(30)
        .returns<LogRow[]>();
      if (logsErr) {
        setError(logsErr.message);
        return;
      }
      const base = logs ?? [];
      const withUrls = await Promise.all(
        base.map(async (l) => {
          if (!l.photo_object_name) return l;
          const { data } = await supabase.storage
            .from("meal-photos")
            .createSignedUrl(l.photo_object_name, 60);
          return { ...l, photoUrl: data?.signedUrl };
        }),
      );
      setRows(withUrls);
    })();
  }, [supabase, patientId]);

  return (
    <div className="pb-8">
      <Topbar title="Registros" />
      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        <Card>
          <Link
            href={`/app/nutri/patients/${patientId}`}
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            ← Paciente
          </Link>
        </Card>

        {error ? (
          <Card className="border-red-200 bg-red-50">
            <p className="text-sm text-red-700">{error}</p>
          </Card>
        ) : null}

        <Card>
          {rows.length ? (
            <ul className="space-y-4">
              {rows.map((l) => (
                <li key={l.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">{l.type}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(l.logged_at).toLocaleString()}
                    </div>
                  </div>
                  {l.type === "checkin" ? (
                    <p className="mt-2 text-sm text-slate-700">
                      {l.adherence ?? "—"} · energía {l.energy ?? "—"} · hambre{" "}
                      {l.hunger ?? "—"}
                    </p>
                  ) : null}
                  {l.reason_codes?.length ? (
                    <p className="mt-1 text-xs text-slate-500">
                      motivos: {l.reason_codes.join(", ")}
                    </p>
                  ) : null}
                  {l.notes ? (
                    <p className="mt-2 text-sm text-slate-700">{l.notes}</p>
                  ) : null}
                  {l.photoUrl ? (
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                      <Image
                        src={l.photoUrl}
                        alt="foto"
                        width={800}
                        height={600}
                        className="h-auto w-full"
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">Sin registros todavía.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

