import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { env } from "@/lib/env";
import { consumeRateLimit } from "@/lib/security/rate-limit";

const payloadSchema = z.object({
  challengeId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rate = consumeRateLimit(`challenge-enroll:${ip}`, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit excedido" }, { status: 429 });
  }

  const rawBody = (await request.json().catch(() => null)) as unknown;
  const parsed = payloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "challengeId invalido" }, { status: 400 });
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
  if (profile?.role !== "patient") {
    return NextResponse.json({ error: "Solo pacientes" }, { status: 403 });
  }

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id,nutri_id,status")
    .eq("id", parsed.data.challengeId)
    .maybeSingle<{ id: string; nutri_id: string; status: "draft" | "active" | "archived" }>();
  if (challengeError) return NextResponse.json({ error: challengeError.message }, { status: 500 });
  if (!challenge) return NextResponse.json({ error: "Reto no encontrado" }, { status: 404 });
  if (challenge.status !== "active") return NextResponse.json({ error: "Reto no activo" }, { status: 409 });

  const { data: careTeam } = await supabase
    .from("care_teams")
    .select("patient_id")
    .eq("patient_id", userData.user.id)
    .eq("nutri_id", challenge.nutri_id)
    .maybeSingle();
  if (!careTeam) {
    return NextResponse.json({ error: "No puedes unirte a este reto privado." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("challenge_participants")
    .upsert(
      {
        challenge_id: parsed.data.challengeId,
        patient_id: userData.user.id,
        status: "active",
      },
      { onConflict: "challenge_id,patient_id" },
    )
    .select("id")
    .single<{ id: string }>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  response = NextResponse.json({ ok: true, participantId: data.id });
  return response;
}
