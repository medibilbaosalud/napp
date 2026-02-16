import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { consumeRateLimit } from "@/lib/security/rate-limit";

type ProfileRole = "patient" | "nutri";

function getClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
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
}

/**
 * GET handler for the challenge feed.
 * Provides a consolidated view of challenges and missions for patients,
 * or a list of managed challenges for nutritionists.
 */
export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  // Apply rate limiting
  const rate = consumeRateLimit(`challenge-feed:${ip}`, 90, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit excedido" }, { status: 429 });
  }

  const response = NextResponse.json({});
  const supabase = getClient(request, response);

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Fetch user profile to determine role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle<{ role: ProfileRole }>();
  if (!profile) return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });

  if (profile.role === "patient") {
    // Ensure daily missions are generated for today
    await supabase.rpc("ensure_daily_missions", { p_day: new Date().toISOString().slice(0, 10) });

    // Fetch both challenges (enrollments) and daily missions
    const [{ data: challenges }, { data: missions }] = await Promise.all([
      supabase
        .from("challenge_participants")
        .select("progress,status,challenges!inner(id,title,description,status,starts_on,ends_on,reward_badge)")
        .eq("patient_id", userData.user.id)
        .order("enrolled_at", { ascending: false }),
      supabase
        .from("daily_missions")
        .select("id,mission_key,title,target_value,mission_completions(id,completed_at)")
        .eq("patient_id", userData.user.id)
        .eq("mission_date", new Date().toISOString().slice(0, 10))
        .order("created_at", { ascending: true }),
    ]);

    // Format challenge data for the frontend
    const challengeFeed = (challenges ?? []).map((row) => {
      const challenge = (row as unknown as { challenges: Record<string, unknown> }).challenges;
      return {
        challengeId: String(challenge.id),
        title: String(challenge.title),
        description: String(challenge.description ?? ""),
        status: String(challenge.status) as "draft" | "active" | "archived",
        startsOn: String(challenge.starts_on),
        endsOn: challenge.ends_on ? String(challenge.ends_on) : null,
        rewardBadge: challenge.reward_badge ? String(challenge.reward_badge) : null,
        enrolled: true,
        progress: Number((row as { progress?: number }).progress ?? 0),
      };
    });

    // Format mission data for the frontend
    const missionFeed = (missions ?? []).map((row) => {
      const completions = (row as { mission_completions?: Array<{ id: string }> }).mission_completions ?? [];
      return {
        id: String((row as { id: string }).id),
        mission_key: String((row as { mission_key: string }).mission_key),
        title: String((row as { title: string }).title),
        target_value: Number((row as { target_value: number }).target_value ?? 1),
        completed: completions.length > 0,
      };
    });

    return NextResponse.json({
      role: "patient",
      challenges: challengeFeed,
      missions: missionFeed,
    });
  }

  // Nutritionist Logic: Fetch challenges they have created
  const { data: challenges } = await supabase
    .from("challenges")
    .select("id,title,description,status,starts_on,ends_on,reward_badge,created_at")
    .eq("nutri_id", userData.user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    role: "nutri",
    challenges: (challenges ?? []).map((c) => ({
      challengeId: c.id,
      title: c.title,
      description: c.description,
      status: c.status,
      startsOn: c.starts_on,
      endsOn: c.ends_on,
      rewardBadge: c.reward_badge,
      enrolled: false,
      progress: 0,
    })),
    missions: [],
  });
}
