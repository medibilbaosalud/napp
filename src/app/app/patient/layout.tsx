import { redirect } from "next/navigation";
import { getServerProfile } from "@/lib/auth/profile";

export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await getServerProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "patient") redirect("/app/nutri/requests");
  return children;
}

