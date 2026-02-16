import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const callbackUrl = `${origin}/auth/callback`;
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL();
  const isSupabaseConfigured = Boolean(supabaseUrl && env.NEXT_PUBLIC_SUPABASE_ANON_KEY());
  const isGoogleOAuthLikelyConfigured = isSupabaseConfigured;

  return NextResponse.json({
    ok: isSupabaseConfigured,
    checks: {
      supabase: isSupabaseConfigured,
      googleOAuthProvider: isGoogleOAuthLikelyConfigured,
    },
    callbackUrl,
    hints: [
      "Verifica en Supabase Auth > Providers que Google esta activado.",
      "Asegura redirect URL exacta en Google Console y Supabase.",
      "Incluye esta URL en redirects: " + callbackUrl,
    ],
  });
}
