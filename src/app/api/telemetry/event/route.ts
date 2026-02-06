import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { eventName?: string; context?: Record<string, unknown> }
    | null;

  const eventName = body?.eventName?.trim();
  if (!eventName) {
    return NextResponse.json({ error: "eventName requerido" }, { status: 400 });
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

  const { error } = await supabase.from("engagement_events").insert({
    user_id: userData.user.id,
    role: profile?.role ?? "patient",
    event_name: eventName,
    context: body?.context ?? {},
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  response = NextResponse.json({ ok: true });
  return response;
}
