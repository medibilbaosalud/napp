import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/nav/BottomNav";

export default async function PatientTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { data: patient } = await supabase
    .from("patients")
    .select("onboarding_completed_at")
    .eq("id", data.user.id)
    .maybeSingle<{ onboarding_completed_at: string | null }>();

  if (!patient?.onboarding_completed_at) redirect("/app/patient/onboarding");

  return (
    <div className="min-h-dvh app-shell pb-24">
      <main className="mx-auto min-h-dvh max-w-md">{children}</main>
      <BottomNav />
    </div>
  );
}
