import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { env } from "@/lib/env";
import { consumeRateLimit } from "@/lib/security/rate-limit";

const payloadSchema = z.object({
  missionId: z.string().uuid(),
  completionKey: z.string().max(120).optional(),
  value: z.number().int().min(1).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rate = consumeRateLimit(`complete-mission:${ip}`, 30, 60_000);
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

  const { data: rpcData, error } = await supabase.rpc("complete_daily_mission", {
    p_mission_id: parsed.data.missionId,
    p_value: parsed.data.value ?? 1,
    p_completion_key: parsed.data.completionKey ?? null,
    p_metadata: parsed.data.metadata ?? {},
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  response = NextResponse.json({ ok: true, completionId: rpcData });
  return response;
}
