import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { env } from "@/lib/env";

const payloadSchema = z.object({
  experimentKey: z.string().min(2).max(120),
  variants: z.array(z.string().min(1).max(80)).min(2).max(6),
});

function hash(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export async function POST(request: NextRequest) {
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

  const payload = parsed.data;
  const { data: existing } = await supabase
    .from("experiment_assignments")
    .select("variant")
    .eq("experiment_key", payload.experimentKey)
    .eq("user_id", userData.user.id)
    .maybeSingle<{ variant: string }>();

  if (existing?.variant) {
    return NextResponse.json({ ok: true, variant: existing.variant, cached: true });
  }

  const selectedVariant = payload.variants[hash(`${payload.experimentKey}:${userData.user.id}`) % payload.variants.length];
  const { error } = await supabase.from("experiment_assignments").insert({
    experiment_key: payload.experimentKey,
    user_id: userData.user.id,
    variant: selectedVariant,
    context: { source: "deterministic_hash" },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  response = NextResponse.json({ ok: true, variant: selectedVariant, cached: false });
  return response;
}
