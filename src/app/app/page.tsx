import { redirect } from "next/navigation";
import { getServerProfile } from "@/lib/auth/profile";

export default async function AppIndexPage() {
  const { profile } = await getServerProfile();
  if (!profile) redirect("/login");

  if (profile.role === "nutri") redirect("/app/nutri/requests");
  redirect("/app/patient/today");
}
