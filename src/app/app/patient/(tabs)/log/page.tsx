"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { compressToJpeg } from "@/lib/images/compress";
import { trackEvent } from "@/lib/telemetry/client";
import { Topbar } from "@/components/ui/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils/cn";

const reasons = [
  { code: "time", label: "Tiempo" },
  { code: "social", label: "Social" },
  { code: "emotional", label: "Emocional" },
  { code: "planning", label: "Planificacion" },
  { code: "sleep", label: "Sueno" },
  { code: "stress", label: "Estres" },
  { code: "other", label: "Otro" },
];

export default function LogPage() {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [mode, setMode] = React.useState<"smart" | "checkin" | "photo">("smart");

  const [adherence, setAdherence] = React.useState<"cumpli" | "a_medias" | "no" | null>(null);
  const [selectedReasons, setSelectedReasons] = React.useState<string[]>([]);
  const [energy, setEnergy] = React.useState<number>(3);
  const [hunger, setHunger] = React.useState<number>(3);

  const [mealSlot, setMealSlot] = React.useState("comida");
  const [file, setFile] = React.useState<File | null>(null);
  const [note, setNote] = React.useState("");

  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase
        .from("logs")
        .select("type,meal_slot")
        .eq("patient_id", userData.user.id)
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ type: "checkin" | "photo" | "detail"; meal_slot: string | null }>();

      if (data?.type === "photo") {
        setMode("photo");
        setMealSlot(data.meal_slot ?? "comida");
      } else {
        setMode("checkin");
      }
    })();
  }, [supabase]);

  function toggleReason(code: string) {
    setSelectedReasons((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  async function saveCheckin() {
    setMsg(null);
    if (!adherence) {
      setMsg("Elige una opcion de adherencia.");
      return;
    }
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { error } = await supabase.from("logs").insert({
        patient_id: userData.user.id,
        type: "checkin",
        adherence,
        reason_codes: selectedReasons,
        energy,
        hunger,
        logged_at: new Date().toISOString(),
      });
      if (error) throw error;

      await supabase.rpc("complete_patient_action", {
        p_action_key: "checkin",
        p_metadata: { adherence },
      });
      trackEvent({ eventName: "save_checkin", context: { adherence, reasons: selectedReasons.length } });
      setMsg("Check-in guardado.");
      setAdherence(null);
      setSelectedReasons([]);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function savePhoto() {
    setMsg(null);
    if (!file) {
      setMsg("Anade una foto para continuar.");
      return;
    }
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const logId = crypto.randomUUID();
      const objectName = `${userData.user.id}/${logId}.jpg`;

      const { error: insertError } = await supabase.from("logs").insert({
        id: logId,
        patient_id: userData.user.id,
        type: "photo",
        meal_slot: mealSlot,
        notes: note || null,
        logged_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;

      const blob = await compressToJpeg(file);
      const { error: uploadError } = await supabase.storage.from("meal-photos").upload(objectName, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("logs")
        .update({ photo_object_name: objectName })
        .eq("id", logId);
      if (updateError) throw updateError;

      await supabase.rpc("complete_patient_action", {
        p_action_key: "photo",
        p_metadata: { mealSlot },
      });
      trackEvent({ eventName: "save_photo", context: { mealSlot } });
      setMsg("Foto guardada.");
      setFile(null);
      setNote("");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const activeMode = mode === "smart" ? "checkin" : mode;

  return (
    <div className="pb-24">
      <Topbar title="Registro inteligente" subtitle="Menos friccion, mas constancia" />
      <div className="space-y-4 px-4 py-4">
        <Card>
          <div className="text-sm font-semibold text-[var(--text)]">Modo</div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {([
              ["smart", "Smart"],
              ["checkin", "Check-in"],
              ["photo", "Foto"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                className={cn(
                  "rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-semibold",
                  mode === key
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "border-[var(--line)] bg-white text-[var(--text-muted)]",
                )}
                onClick={() => setMode(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </Card>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <div className="text-sm font-semibold text-[var(--text)]">Check-in rapido</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([
                ["cumpli", "Cumpli"],
                ["a_medias", "A medias"],
                ["no", "No"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setAdherence(value)}
                  className={cn(
                    "rounded-[var(--radius-sm)] border px-3 py-2 text-sm",
                    adherence === value
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                      : "border-[var(--line)] bg-white text-[var(--text-muted)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {reasons.map((r) => (
                <button
                  key={r.code}
                  onClick={() => toggleReason(r.code)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    selectedReasons.includes(r.code)
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                      : "border-[var(--line)] bg-white text-[var(--text-muted)]",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-medium text-[var(--text-muted)]">Energia</div>
                <input className="mt-2 w-full" type="range" min={1} max={5} value={energy} onChange={(e) => setEnergy(Number(e.target.value))} />
              </div>
              <div>
                <div className="text-xs font-medium text-[var(--text-muted)]">Hambre</div>
                <input className="mt-2 w-full" type="range" min={1} max={5} value={hunger} onChange={(e) => setHunger(Number(e.target.value))} />
              </div>
            </div>

            <div className="mt-4">
              <Button className="w-full" onClick={saveCheckin} disabled={busy || activeMode === "photo"}>
                Guardar check-in
              </Button>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <div className="text-sm font-semibold text-[var(--text)]">Foto y contexto</div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {["desayuno", "comida", "cena", "snack"].map((slot) => (
                <button
                  key={slot}
                  onClick={() => setMealSlot(slot)}
                  className={cn(
                    "rounded-[var(--radius-sm)] border px-2 py-2 text-xs font-semibold",
                    mealSlot === slot
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                      : "border-[var(--line)] bg-white text-[var(--text-muted)]",
                  )}
                >
                  {slot}
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota opcional" />
            </div>
            <div className="mt-4">
              <Button className="w-full" onClick={savePhoto} disabled={busy || activeMode === "checkin"}>
                Guardar foto
              </Button>
            </div>
          </Card>
        </motion.div>

        {msg ? (
          <Card>
            <p className="text-sm text-[var(--text)]">{msg}</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
