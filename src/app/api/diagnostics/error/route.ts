import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { diagnosticPayloadSchema } from "@/lib/diagnostics/schema";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rate = consumeRateLimit(`diagnostics:${ip}`, 40, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit excedido" }, { status: 429 });
  }

  const rawBody = (await request.json().catch(() => null)) as unknown;
  const parsed = diagnosticPayloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload diagnostico invalido" }, { status: 400 });
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
  // Public routes can emit diagnostics before auth is established.
  // Do not fail the request in that case to avoid noisy 500 loops.
  if (!userData.user) {
    return NextResponse.json({ ok: true, skipped: "unauthenticated" }, { status: 202 });
  }

  const payload = parsed.data;
  const { error } = await supabase.from("app_error_events").insert({
    user_id: userData.user.id,
    route: payload.route ?? null,
    component: payload.component ?? null,
    severity: payload.severity,
    error_name: payload.errorName,
    error_message: payload.errorMessage,
    error_code: payload.errorCode ?? null,
    stack: payload.stack ?? null,
    fingerprint: payload.fingerprint ?? null,
    context: payload.context ?? {},
    environment: payload.environment ?? {},
  });

  if (error) {
    // Diagnostics should be best-effort and never break the app flow.
    return NextResponse.json({ ok: false, skipped: "insert_failed" }, { status: 202 });
  }

  response = NextResponse.json({ ok: true });
  return response;
}

export async function GET(request: NextRequest) {
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
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const limit = Math.min(200, Math.max(10, Number(request.nextUrl.searchParams.get("limit") ?? "100")));
  const { data, error } = await supabase
    .from("app_error_events")
    .select("id,created_at,route,component,severity,error_name,error_message,error_code,fingerprint,context,environment")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const grouped = new Map<
    string,
    {
      fingerprint: string;
      count: number;
      lastSeen: string;
      severity: string;
      errorName: string;
      errorMessage: string;
      sampleRoute: string | null;
    }
  >();

  for (const row of rows) {
    const fp = row.fingerprint ?? `${row.error_name}:${row.route ?? "unknown"}`;
    const current = grouped.get(fp);
    if (!current) {
      grouped.set(fp, {
        fingerprint: fp,
        count: 1,
        lastSeen: row.created_at,
        severity: row.severity,
        errorName: row.error_name,
        errorMessage: row.error_message,
        sampleRoute: row.route,
      });
      continue;
    }

    current.count += 1;
    if (new Date(row.created_at).getTime() > new Date(current.lastSeen).getTime()) {
      current.lastSeen = row.created_at;
    }
  }

  const summary = Array.from(grouped.values()).sort((a, b) => b.count - a.count);
  response = NextResponse.json({
    total: rows.length,
    topIssues: summary.slice(0, 20),
    latest: rows.slice(0, 40),
  });
  return response;
}
