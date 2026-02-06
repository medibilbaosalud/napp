import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { score?: number; comment?: string; context?: Record<string, unknown> }
    | null;

  const score = body?.score;
  if (typeof score !== "number" || score < 0 || score > 10) {
    return NextResponse.json({ error: "score invalido" }, { status: 400 });
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

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("submit_nps_response", {
    p_score: score,
    p_comment: body?.comment ?? "",
    p_context: body?.context ?? {},
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  response = NextResponse.json({ ok: true, id: data });
  return response;
}
