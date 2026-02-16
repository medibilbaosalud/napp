"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Topbar } from "@/components/ui/Topbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type ShoppingListRow = { id: string; week_start: string; plan_id: string | null };
type ShoppingItemRow = {
  id: string;
  name: string;
  category: string | null;
  quantity: string | null;
  is_checked: boolean;
  sort_order: number;
};

function extractSeed(planData: unknown): Array<{ name: string; category?: string; quantity?: string }> {
  if (!planData || typeof planData !== "object") return [];
  const rec = planData as Record<string, unknown>;
  const shoppingSeed = rec.shopping_seed;
  if (Array.isArray(shoppingSeed)) {
    const out: Array<{ name: string; category?: string; quantity?: string }> = [];
    for (const x of shoppingSeed) {
      if (!x || typeof x !== "object") continue;
      const r = x as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name : "";
      if (!name.trim()) continue;
      const category = typeof r.category === "string" ? r.category : undefined;
      const quantity = typeof r.quantity === "string" ? r.quantity : undefined;
      out.push({ name, category, quantity });
    }
    return out;
  }

  const mealsValue = rec.meals;
  const meals = Array.isArray(mealsValue) ? mealsValue : [];
  const set = new Set<string>();
  for (const m of meals) {
    const mealRec = typeof m === "object" && m ? (m as Record<string, unknown>) : {};
    for (const key of ["optionA", "optionB", "out"] as const) {
      const arr = Array.isArray(mealRec[key]) ? (mealRec[key] as unknown[]) : [];
      for (const item of arr) {
        if (typeof item === "string" && item.trim()) set.add(item.trim());
      }
    }
  }
  return Array.from(set).slice(0, 30).map((name) => ({ name }));
}

const container = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.05, delayChildren: 0.03 },
  },
};

const itemMotion = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function ShoppingPage() {
  const search = useSearchParams();
  const week = search.get("week");
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = React.useState(true);
  const [list, setList] = React.useState<ShoppingListRow | null>(null);
  const [items, setItems] = React.useState<ShoppingItemRow[]>([]);
  const [newItem, setNewItem] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      if (!week) return;
      setError(null);
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const { data: plan } = await supabase
          .from("plans")
          .select("id,plan_data")
          .eq("patient_id", userData.user.id)
          .eq("week_start", week)
          .maybeSingle<{ id: string; plan_data: unknown }>();

        let { data: sl } = await supabase
          .from("shopping_lists")
          .select("id,week_start,plan_id")
          .eq("patient_id", userData.user.id)
          .eq("week_start", week)
          .maybeSingle<ShoppingListRow>();

        if (!sl) {
          const { data: created, error: createError } = await supabase
            .from("shopping_lists")
            .insert({
              patient_id: userData.user.id,
              week_start: week,
              plan_id: plan?.id ?? null,
            })
            .select("id,week_start,plan_id")
            .single<ShoppingListRow>();
          if (createError) throw createError;
          sl = created;

          const seed = extractSeed(plan?.plan_data ?? {});
          if (seed.length) {
            const { error: itemsError } = await supabase.from("shopping_list_items").insert(
              seed.map((s, idx) => ({
                shopping_list_id: sl!.id,
                name: s.name,
                category: s.category ?? null,
                quantity: s.quantity ?? null,
                source: "generated",
                sort_order: idx,
              })),
            );
            if (itemsError) throw itemsError;
          }
        }

        setList(sl);

        const { data: itemRows, error: itemsFetchError } = await supabase
          .from("shopping_list_items")
          .select("id,name,category,quantity,is_checked,sort_order")
          .eq("shopping_list_id", sl.id)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
          .returns<ShoppingItemRow[]>();
        if (itemsFetchError) throw itemsFetchError;
        setItems(itemRows ?? []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, week]);

  async function toggleItem(id: string, is_checked: boolean) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, is_checked } : it)));
    await supabase.from("shopping_list_items").update({ is_checked }).eq("id", id);
  }

  async function updateQty(id: string, quantity: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, quantity } : it)));
    await supabase.from("shopping_list_items").update({ quantity }).eq("id", id);
  }

  async function addItem() {
    if (!list) return;
    const name = newItem.trim();
    if (!name) return;
    setNewItem("");
    const sort_order = items.length ? items[items.length - 1]!.sort_order + 1 : 0;
    const { data, error: insertError } = await supabase
      .from("shopping_list_items")
      .insert({
        shopping_list_id: list.id,
        name,
        source: "manual",
        sort_order,
      })
      .select("id,name,category,quantity,is_checked,sort_order")
      .single<ShoppingItemRow>();
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setItems((prev) => [...prev, data]);
  }

  async function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
    await supabase.from("shopping_list_items").delete().eq("id", id);
  }

  const done = items.filter((it) => it.is_checked).length;
  const total = items.length;
  const ratio = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="pb-28">
      <Topbar title="Lista de la compra" subtitle="Editable, rapida y pensada para la semana" />

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-4 px-4 py-4">
        {!week ? (
          <motion.div variants={itemMotion}>
            <Card className="border-[var(--danger)]/30 bg-red-50">
              <p className="text-sm text-[var(--danger)]">Falta el parametro de semana.</p>
            </Card>
          </motion.div>
        ) : null}

        {error ? (
          <motion.div variants={itemMotion}>
            <Card className="border-[var(--danger)]/30 bg-red-50">
              <p className="text-sm text-[var(--danger)]">{error}</p>
            </Card>
          </motion.div>
        ) : null}

        <motion.div variants={itemMotion}>
          <Card className="relative overflow-hidden">
            <motion.div
              className="absolute -right-7 -top-7 h-24 w-24 rounded-full bg-[var(--accent-soft)]/70"
              animate={{ scale: [1, 1.18, 1], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 7, repeat: Infinity }}
            />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                  <ShoppingBasket className="h-4 w-4 text-[var(--accent)]" />
                  Estado de la lista
                </div>
                <span className="text-sm font-semibold text-[var(--text)]">{done}/{total}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--accent-soft)]/50">
                <motion.div className="h-full bg-[var(--accent)]" initial={{ width: 0 }} animate={{ width: `${ratio}%` }} transition={{ duration: 0.4 }} />
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">{ratio}% completado</p>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemMotion}>
          <Card>
            <div className="flex gap-2">
              <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Anadir item..." />
              <Button onClick={addItem} disabled={!newItem.trim() || loading}>
                <Plus className="h-4 w-4" />
                Anadir
              </Button>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Marca lo que ya tienes y ajusta cantidades en vivo.</p>
          </Card>
        </motion.div>

        <motion.div variants={itemMotion}>
          <Card>
            {loading ? (
              <p className="text-sm text-[var(--text-muted)]">Cargando...</p>
            ) : items.length ? (
              <ul className="space-y-3">
                {items.map((it) => (
                  <motion.li key={it.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-white p-2.5">
                    <input type="checkbox" checked={it.is_checked} onChange={(e) => toggleItem(it.id, e.target.checked)} />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[var(--text)]">{it.name}</div>
                      <div className="mt-1">
                        <input
                          className="w-full rounded-[var(--radius-sm)] border border-[var(--line)] px-2 py-1 text-xs text-[var(--text)]"
                          value={it.quantity ?? ""}
                          placeholder="Cantidad (opcional)"
                          onChange={(e) => updateQty(it.id, e.target.value)}
                        />
                      </div>
                    </div>
                    <button className="rounded-md p-1 text-[var(--text-muted)] hover:bg-red-50 hover:text-[var(--danger)]" onClick={() => removeItem(it.id)} aria-label="Borrar item">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </motion.li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Aun no hay items. Anade el primero arriba.</p>
            )}
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
