import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { getWeekStartMonday, formatDateISO } from "@/lib/date/week";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function groqChat({
  apiKey,
  model,
  messages,
  temperature = 0,
  max_tokens = 500,
}: {
  apiKey: string;
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  max_tokens?: number;
}) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message ?? `Groq error (${res.status})`;
    throw new Error(msg);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq: empty response");
  return String(content);
}

async function guardAllow({
  apiKey,
  model,
  input,
  purpose,
}: {
  apiKey: string;
  model: string;
  input: string;
  purpose: "prompt_injection" | "safety";
}) {
  const system =
    purpose === "prompt_injection"
      ? "You are a prompt-injection classifier. Output exactly one token: ALLOW or BLOCK."
      : "You are a safety classifier for a clinical nutrition companion app. Output exactly one token: ALLOW or BLOCK.";

  const out = await groqChat({
    apiKey,
    model,
    temperature: 0,
    max_tokens: 5,
    messages: [
      { role: "system", content: system },
      { role: "user", content: input },
    ],
  });

  return out.trim().toUpperCase().startsWith("ALLOW");
}

export async function POST(request: NextRequest) {
  const apiKey = env.GROQ_API_KEY();
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI no configurada (falta GROQ_API_KEY)." },
      { status: 501 },
    );
  }

  const body = (await request.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message) return NextResponse.json({ error: "Mensaje vacío." }, { status: 400 });

  let response = NextResponse.json({});

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL(),
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY(),
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("locale,role")
    .eq("id", userData.user.id)
    .maybeSingle<{ locale: "es" | "eu"; role: "patient" | "nutri" }>();

  if (profile?.role !== "patient") {
    return NextResponse.json({ error: "Solo disponible para pacientes." }, { status: 403 });
  }

  type AiLimitRow = { allowed: boolean; new_count: number };
  const { data: limitData, error: limitError } = await supabase.rpc("ai_check_and_increment", {
    p_max: 20,
  });
  if (limitError) {
    return NextResponse.json({ error: limitError.message }, { status: 500 });
  }
  const limitRows = limitData as unknown as AiLimitRow[] | AiLimitRow | null;
  const allowed = Array.isArray(limitRows) ? limitRows[0]?.allowed : limitRows?.allowed;
  if (!allowed) {
    return NextResponse.json(
      { error: "Has alcanzado el límite diario del asistente." },
      { status: 429 },
    );
  }

  const injectionOk = await guardAllow({
    apiKey,
    model: "llama-prompt-guard-2-86m",
    input: message,
    purpose: "prompt_injection",
  });
  if (!injectionOk) {
    return NextResponse.json(
      { answer: "Prefiero mantener el contexto clínico. Pregunta sobre tu plan o escribe al nutri." },
      { status: 200 },
    );
  }

  const safetyOk = await guardAllow({
    apiKey,
    model: "llama-guard-4-12b",
    input: message,
    purpose: "safety",
  });
  if (!safetyOk) {
    return NextResponse.json(
      {
        answer:
          "No puedo ayudar con eso. Si es una duda médica o urgente, consulta con tu nutricionista o un profesional sanitario.",
      },
      { status: 200 },
    );
  }

  const weekStartIso = formatDateISO(getWeekStartMonday(new Date()));
  const { data: plan } = await supabase
    .from("plans")
    .select("plan_data,schema_version,status,published_at")
    .eq("patient_id", userData.user.id)
    .eq("week_start", weekStartIso)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      plan_data: unknown;
      schema_version: number;
      status: "draft" | "published";
      published_at: string | null;
    }>();

  const { data: lessons } = await supabase
    .from("content_lessons")
    .select("title_es,body_es,title_eu,body_eu,tags")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(5)
    .returns<
      Array<{
        title_es: string;
        body_es: string;
        title_eu: string;
        body_eu: string;
        tags: string[];
      }>
    >();

  const locale = profile?.locale ?? "es";
  const lessonsText =
    (lessons ?? [])
      .map((l) => {
        const title = locale === "eu" ? l.title_eu : l.title_es;
        const body = locale === "eu" ? l.body_eu : l.body_es;
        return `- ${title}: ${body}`;
      })
      .join("\n") || "(none)";

  const planJson = plan?.plan_data ? JSON.stringify(plan.plan_data) : "{}";
  const planMeta = JSON.stringify({
    schema_version: plan?.schema_version ?? 1,
    status: plan?.status ?? "draft",
    published_at: plan?.published_at ?? null,
  });

  const system = locale === "eu"
    ? "Zure elikadura-planari buruzko laguntzailea zara. Emandako PLAN_JSON eta LESSONS bakarrik erabili. Ez eman diagnostikorik, ez botikarik, ez kaloria/makro estimaziorik, ezta plan berri oso bat ere. Zalantza medikoa bada edo planetik kanpo badago, bideratu nutrizionistara."
    : "Eres un asistente sobre el plan nutricional. Usa SOLO el PLAN_JSON y LESSONS proporcionados. No des diagnósticos, no indiques fármacos, no estimes calorías/macros y no crees un plan completo nuevo. Si es duda médica o falta contexto del plan, deriva al nutricionista.";

  const answer = await groqChat({
    apiKey,
    model: "llama-3.1-8b-instant",
    temperature: 0.3,
    max_tokens: 400,
    messages: [
      { role: "system", content: system },
      {
        role: "system",
        content: `LOCALE=${locale}\nWEEK_START=${weekStartIso}\nPLAN_META=${planMeta}\nPLAN_JSON=${planJson}\nLESSONS:\n${lessonsText}`,
      },
      { role: "user", content: message },
    ],
  });

  response = NextResponse.json({ answer });
  return response;
}
