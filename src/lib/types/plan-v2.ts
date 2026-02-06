export type PlanMealSlot = {
  slot: string;
  optionA: string[];
  optionB: string[];
  out: string[];
  notes?: string;
};

export type ShoppingSeedItem = {
  name: string;
  category?: string;
  quantity?: string;
};

export type PlanV2 = {
  schema_version: 2;
  title?: string;
  general_notes: string;
  meals: PlanMealSlot[];
  shopping_seed: ShoppingSeedItem[];
  daily_focus?: Array<{
    day: string;
    focus: string;
  }>;
};

export function isPlanV2(value: unknown): value is PlanV2 {
  if (!value || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  if (rec.schema_version !== 2) return false;
  if (!Array.isArray(rec.meals)) return false;
  if (!Array.isArray(rec.shopping_seed)) return false;
  return true;
}

export function toPlanV2(value: unknown): PlanV2 {
  if (isPlanV2(value)) return value;
  const rec = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const meals = Array.isArray(rec.meals)
    ? rec.meals
        .map((meal) => {
          const m = (meal && typeof meal === "object" ? meal : {}) as Record<string, unknown>;
          return {
            slot: typeof m.slot === "string" ? m.slot : "Comida",
            optionA: Array.isArray(m.optionA) ? m.optionA.filter((x): x is string => typeof x === "string") : [],
            optionB: Array.isArray(m.optionB) ? m.optionB.filter((x): x is string => typeof x === "string") : [],
            out: Array.isArray(m.out) ? m.out.filter((x): x is string => typeof x === "string") : [],
            notes: typeof m.notes === "string" ? m.notes : undefined,
          };
        })
        .filter((m) => m.slot.length > 0)
    : [];

  const shopping_seed = Array.isArray(rec.shopping_seed)
    ? rec.shopping_seed
        .map((item) => {
          const it = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
          return {
            name: typeof it.name === "string" ? it.name : "",
            category: typeof it.category === "string" ? it.category : undefined,
            quantity: typeof it.quantity === "string" ? it.quantity : undefined,
          };
        })
        .filter((it) => it.name.trim().length > 0)
    : [];

  return {
    schema_version: 2,
    title: typeof rec.title === "string" ? rec.title : undefined,
    general_notes: typeof rec.general_notes === "string" ? rec.general_notes : "",
    meals,
    shopping_seed,
    daily_focus: Array.isArray(rec.daily_focus)
      ? rec.daily_focus
          .map((d) => {
            const day = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
            return {
              day: typeof day.day === "string" ? day.day : "",
              focus: typeof day.focus === "string" ? day.focus : "",
            };
          })
          .filter((d) => d.day && d.focus)
      : [],
  };
}
