import { redirect } from "next/navigation";
import { getServerProfile } from "@/lib/auth/profile";

export default async function NutriLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await getServerProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "nutri") redirect("/app/patient/today");

  return <div className="min-h-dvh app-shell">{children}</div>;
}
