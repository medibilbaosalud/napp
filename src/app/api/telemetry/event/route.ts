import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { telemetryEventSchemaV2, telemetryLegacySchema } from "@/lib/telemetry/schema";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rate = consumeRateLimit(`telemetry:${ip}`, 120, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit excedido" }, { status: 429 });
  }

  const rawBody = (await request.json().catch(() => null)) as unknown;
  const parsedV2 = telemetryEventSchemaV2.safeParse(rawBody);
  const parsedLegacy = telemetryLegacySchema.safeParse(rawBody);

  if (!parsedV2.success && !parsedLegacy.success) {
    return NextResponse.json({ error: "Payload telemetry invalido" }, { status: 400 });
  }

  const payload = parsedV2.success
    ? parsedV2.data
    : parsedLegacy.success
      ? {
          schemaVersion: 2 as const,
          eventName: parsedLegacy.data.eventName,
          context: parsedLegacy.data.context ?? {},
          source: "web" as const,
        }
      : null;

  if (!payload) {
    return NextResponse.json({ error: "Payload telemetry invalido" }, { status: 400 });
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
  if (!userData.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle<{ role: "patient" | "nutri" }>();

  const contextWithMeta = {
    ...(payload.context ?? {}),
    _schema_version: payload.schemaVersion,
    _source: payload.source ?? "web",
  };

  const { error } = await supabase.from("engagement_events").insert({
    user_id: userData.user.id,
    role: profile?.role ?? "patient",
    event_name: payload.eventName,
    context: contextWithMeta,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  response = NextResponse.json({ ok: true });
  return response;
}
