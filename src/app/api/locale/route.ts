import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/supabase/constants";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { locale?: string }
    | null;
  const locale = body?.locale === "eu" ? "eu" : "es";

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL(),
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY(),
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  if (data.user) {
    await supabase.from("profiles").update({ locale }).eq("id", data.user.id);
  }

  return response;
}
