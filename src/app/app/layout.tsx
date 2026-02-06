import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { getServerProfile } from "@/lib/auth/profile";
import { LOCALE_COOKIE } from "@/lib/supabase/constants";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getServerProfile();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const initialLocale =
    (profile?.locale ?? (cookieLocale === "eu" ? "eu" : "es")) as "es" | "eu";

  return <LocaleProvider initialLocale={initialLocale}>{children}</LocaleProvider>;
}
