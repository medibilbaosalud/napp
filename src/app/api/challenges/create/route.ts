import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { env } from "@/lib/env";
import { consumeRateLimit } from "@/lib/security/rate-limit";

const payloadSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(600).default(""),
  startsOn: z.string().optional(),
  endsOn: z.string().optional(),
  rewardBadge: z.string().max(120).optional(),
  patientIds: z.array(z.string().uuid()).default([]),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rate = consumeRateLimit(`challenge-create:${ip}`, 12, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit excedido" }, { status: 429 });
  }

  const rawBody = (await request.json().catch(() => null)) as unknown;
  const parsed = payloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalido", details: parsed.error.flatten() }, { status: 400 });
  }

  let response = NextResponse.json({ ok: true });
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
  if (!userData.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle<{ role: "patient" | "nutri" }>();
  if (profile?.role !== "nutri") {
    return NextResponse.json({ error: "Solo nutricionistas" }, { status: 403 });
  }

  const payload = parsed.data;
  const startsOn = payload.startsOn ?? new Date().toISOString().slice(0, 10);

  const { data: challenge, error } = await supabase
    .from("challenges")
    .insert({
      nutri_id: userData.user.id,
      title: payload.title,
      description: payload.description,
      starts_on: startsOn,
      ends_on: payload.endsOn ?? null,
      reward_badge: payload.rewardBadge ?? null,
      status: "active",
    })
    .select("id")
    .single<{ id: string }>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (payload.patientIds.length) {
    const rows = payload.patientIds.map((patientId) => ({
      challenge_id: challenge.id,
      patient_id: patientId,
      status: "active",
    }));
    await supabase.from("challenge_participants").upsert(rows, {
      onConflict: "challenge_id,patient_id",
    });
  }

  response = NextResponse.json({ ok: true, challengeId: challenge.id });
  return response;
}
