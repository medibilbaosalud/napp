"use client";

import * as React from "react";
import Link from "next/link";
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
      <Topbar title="Solicitudes" />
      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        <Card className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Nutri</div>
            <p className="mt-1 text-xs text-slate-500">
              Acepta para crear care_team + thread (atómico).
            </p>
          </div>
          <Link
            href="/app/nutri/patients"
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            Ver pacientes
          </Link>
        </Card>

        {error ? (
          <Card className="border-red-200 bg-red-50">
            <p className="text-sm text-red-700">{error}</p>
          </Card>
        ) : null}

        <Card>
          {loading ? (
            <p className="text-sm text-slate-600">Cargando…</p>
          ) : rows.length ? (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {r.patient_display_name || r.patient_email || r.patient_id}
                  </div>
                  {r.patient_note ? (
                    <p className="mt-1 text-sm text-slate-600">{r.patient_note}</p>
                  ) : null}
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
            <p className="text-sm text-slate-600">No hay solicitudes pendientes.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
