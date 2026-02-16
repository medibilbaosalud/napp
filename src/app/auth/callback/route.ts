import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

function sanitizeNext(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/app";
  }
  return nextPath;
}

function authErrorRedirect(url: URL, next: string, code: string) {
  const login = new URL("/login", url.origin);
  login.searchParams.set("oauth_error", code);
  login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");
  const next = sanitizeNext(url.searchParams.get("next"));

  if (oauthError) {
    return authErrorRedirect(url, next, oauthError);
  }

  if (!code) {
    return authErrorRedirect(url, next, "missing_code");
  }

  const response = NextResponse.redirect(new URL(next, url.origin));
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL(),
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return authErrorRedirect(url, next, "exchange_failed");
    }
    return response;
  } catch {
    return authErrorRedirect(url, next, "exchange_exception");
  }
}
