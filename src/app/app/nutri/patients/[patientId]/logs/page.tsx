"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Camera, ClipboardList } from "lucide-react";
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

type FilterType = "all" | "checkin" | "photo" | "detail";

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

export default function NutriLogsPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = React.useState<Array<LogRow & { photoUrl?: string }>>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<FilterType>("all");

  React.useEffect(() => {
    (async () => {
      setError(null);
      const { data: logs, error: logsErr } = await supabase
        .from("logs")
        .select("id,type,adherence,reason_codes,energy,hunger,notes,photo_object_name,logged_at")
        .eq("patient_id", patientId)
        .order("logged_at", { ascending: false })
        .limit(40)
        .returns<LogRow[]>();
      if (logsErr) {
        setError(logsErr.message);
        return;
      }
      const base = logs ?? [];
      const withUrls = await Promise.all(
        base.map(async (l) => {
          if (!l.photo_object_name) return l;
          const { data } = await supabase.storage.from("meal-photos").createSignedUrl(l.photo_object_name, 60);
          return { ...l, photoUrl: data?.signedUrl };
        }),
      );
      setRows(withUrls);
    })();
  }, [supabase, patientId]);

  const filtered = rows.filter((row) => filter === "all" || row.type === filter);
  const checkins = rows.filter((r) => r.type === "checkin").length;
  const photos = rows.filter((r) => r.type === "photo").length;

  return (
    <div className="pb-8">
      <Topbar title="Registros" subtitle="Timeline reciente del paciente" />

      <motion.div variants={container} initial="hidden" animate="show" className="mx-auto max-w-md space-y-4 px-4 py-4">
        <motion.div variants={item}>
          <Card>
            <Link href={`/app/nutri/patients/${patientId}`} className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]">
              {"<-"} Paciente
            </Link>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="grid grid-cols-2 gap-2">
            <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2">
              <p className="text-xs text-[var(--text-muted)]">Check-ins</p>
              <p className="text-xl font-semibold text-[var(--text)]">{checkins}</p>
            </div>
            <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2">
              <p className="text-xs text-[var(--text-muted)]">Fotos</p>
              <p className="text-xl font-semibold text-[var(--text)]">{photos}</p>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <div className="text-sm font-semibold text-[var(--text)]">Filtro</div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {([
                ["all", "Todo"],
                ["checkin", "Check-in"],
                ["photo", "Foto"],
                ["detail", "Detalle"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`rounded-[var(--radius-sm)] border px-2 py-1.5 text-xs font-medium ${
                    filter === key
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                      : "border-[var(--line)] bg-white text-[var(--text-muted)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Card>
        </motion.div>

        {error ? (
          <motion.div variants={item}>
            <Card className="border-[var(--danger)]/30 bg-red-50">
              <p className="text-sm text-[var(--danger)]">{error}</p>
            </Card>
          </motion.div>
        ) : null}

        <motion.div variants={item}>
          <Card>
            {filtered.length ? (
              <ul className="space-y-4">
                {filtered.map((l) => (
                  <motion.li key={l.id} whileHover={{ y: -1 }} className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-white p-3">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--text)]">
                        {l.type === "photo" ? <Camera className="h-4 w-4 text-[var(--accent)]" /> : <ClipboardList className="h-4 w-4 text-[var(--accent)]" />}
                        {l.type}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">{new Date(l.logged_at).toLocaleString()}</div>
                    </div>

                    {l.type === "checkin" ? (
                      <p className="mt-2 text-sm text-[var(--text)]">
                        {l.adherence ?? "-"} · energia {l.energy ?? "-"} · hambre {l.hunger ?? "-"}
                      </p>
                    ) : null}

                    {l.reason_codes?.length ? (
                      <p className="mt-1 text-xs text-[var(--text-muted)]">motivos: {l.reason_codes.join(", ")}</p>
                    ) : null}

                    {l.notes ? <p className="mt-2 text-sm text-[var(--text)]">{l.notes}</p> : null}

                    {l.photoUrl ? (
                      <div className="mt-3 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--line)]">
                        <Image src={l.photoUrl} alt="foto" width={800} height={600} className="h-auto w-full" />
                      </div>
                    ) : null}
                  </motion.li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Sin registros todavia.</p>
            )}
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
