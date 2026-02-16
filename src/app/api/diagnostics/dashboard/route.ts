import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { env } from "@/lib/env";
import { consumeRateLimit } from "@/lib/security/rate-limit";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(14),
});

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rate = consumeRateLimit(`diagnostics-dashboard:${ip}`, 40, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit excedido" }, { status: 429 });
  }

  const parsed = querySchema.safeParse({
    days: request.nextUrl.searchParams.get("days") ?? "14",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Parametro days invalido" }, { status: 400 });
  }

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

  const { data, error } = await supabase.rpc("get_error_dashboard", {
    p_days: parsed.data.days,
  });

  if (error) {
    const message = error.message.includes("only_nutri")
      ? "Solo nutricionistas pueden ver este dashboard."
      : error.message;
    return NextResponse.json({ error: message }, { status: 403 });
  }

  response = NextResponse.json({ ok: true, dashboard: data });
  return response;
}
