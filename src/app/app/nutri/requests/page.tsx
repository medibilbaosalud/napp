"use client";

import * as React from "react";
import Link from "next/link";
import { Inbox, Link2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Topbar } from "@/components/ui/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type RequestRow = {
  id: string;
  patient_id: string;
  patient_display_name: string | null;
  patient_email: string | null;
  patient_note: string | null;
  created_at: string;
  status: "pending" | "approved" | "rejected";
};

export default function NutriRequestsPage() {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = React.useState<RequestRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from("patient_link_requests")
        .select("id,patient_id,patient_display_name,patient_email,patient_note,created_at,status")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .returns<RequestRow[]>();
      if (fetchError) throw fetchError;
      setRows(data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function accept(id: string) {
    setError(null);
    const { error: rpcError } = await supabase.rpc("accept_link_request", {
      p_request_id: id,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    await refresh();
  }

  async function reject(id: string) {
    setError(null);
    const { error: rpcError } = await supabase.rpc("reject_link_request", {
      p_request_id: id,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    await refresh();
  }

  return (
    <div className="pb-8">
      <Topbar title="Solicitudes" subtitle="Vinculaciones pendientes con pacientes" />
      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        <Card className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">Flujo de vinculacion</div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Al aceptar se crea care_team + thread en el mismo paso.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/app/nutri/errors">
              <Button variant="secondary">Errores</Button>
            </Link>
            <Link href="/app/nutri/patients" className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]">
              Ver pacientes
            </Link>
          </div>
        </Card>

        {error ? (
          <Card className="border-[var(--danger)]/30 bg-red-50">
            <p className="text-sm text-[var(--danger)]">{error}</p>
          </Card>
        ) : null}

        <Card>
          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">Cargando...</p>
          ) : rows.length ? (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li key={r.id} className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                    <Link2 className="h-4 w-4 text-[var(--accent)]" />
                    {r.patient_display_name || r.patient_email || r.patient_id}
                  </div>
                  {r.patient_note ? (
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{r.patient_note}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{new Date(r.created_at).toLocaleString()}</p>
                  <div className="mt-3 flex gap-2">
                    <Button onClick={() => accept(r.id)}>Aceptar</Button>
                    <Button variant="secondary" onClick={() => reject(r.id)}>
                      Rechazar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <Inbox className="h-4 w-4" />
              No hay solicitudes pendientes.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
