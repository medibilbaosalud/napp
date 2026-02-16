import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { env } from "@/lib/env";
import type { OnboardingStepKey } from "@/lib/types/engagement";

const stepSchema = z.object({
  stepKey: z.enum(["profile", "tracking", "link", "consent", "complete"]),
  stepData: z.record(z.string(), z.unknown()).default({}),
  completed: z.boolean().default(false),
  sourceChannel: z.string().max(80).optional(),
});

type OnboardingSessionRow = {
  step_key: OnboardingStepKey;
  step_data: Record<string, unknown>;
  completed: boolean;
  source_channel: string;
  updated_at: string;
};

function getClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
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
}

export async function GET(request: NextRequest) {
  const response = NextResponse.json({});
  const supabase = getClient(request, response);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle<{ role: "patient" | "nutri" }>();
  if (profile?.role !== "patient") {
    return NextResponse.json({ error: "Solo pacientes" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("onboarding_sessions")
    .select("step_key,step_data,completed,source_channel,updated_at")
    .eq("patient_id", userData.user.id)
    .order("updated_at", { ascending: false })
    .returns<OnboardingSessionRow[]>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    steps: data ?? [],
    latestStep: data?.[0]?.step_key ?? null,
  });
}

export async function POST(request: NextRequest) {
  const rawBody = (await request.json().catch(() => null)) as unknown;
  const parsed = stepSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalido", details: parsed.error.flatten() }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  const supabase = getClient(request, response);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle<{ role: "patient" | "nutri" }>();
  if (profile?.role !== "patient") {
    return NextResponse.json({ error: "Solo pacientes" }, { status: 403 });
  }

  const payload = parsed.data;
  const { error } = await supabase.from("onboarding_sessions").upsert(
    {
      patient_id: userData.user.id,
      step_key: payload.stepKey,
      step_data: payload.stepData ?? {},
      completed: payload.completed,
      source_channel: payload.sourceChannel ?? "direct",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "patient_id,step_key" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (payload.stepKey === "complete" && payload.completed) {
    await supabase
      .from("patients")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", userData.user.id);
  }

  return NextResponse.json({ ok: true });
}
