import { redirect } from "next/navigation";
import { getServerProfile } from "@/lib/auth/profile";
import { Atmosphere } from "@/components/ui/Atmosphere";

export default async function NutriLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await getServerProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "nutri") redirect("/app/patient/today");

  return (
    <div className="min-h-dvh app-shell">
      <Atmosphere />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
