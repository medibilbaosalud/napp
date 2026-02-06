import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UserRole = "patient" | "nutri";

export type Profile = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
  locale: "es" | "eu";
};

export async function getServerProfile() {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { user: null, profile: null };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,role,full_name,locale")
    .eq("id", userData.user.id)
    .maybeSingle<Profile>();

  if (profileError || !profile) return { user: userData.user, profile: null };
  return { user: userData.user, profile };
}
