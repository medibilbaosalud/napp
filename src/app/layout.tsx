import type { Metadata } from "next";
import { Geist_Mono, Manrope, Newsreader } from "next/font/google";
import { cookies } from "next/headers";
import { ClientErrorBoundary } from "@/components/diagnostics/ClientErrorBoundary";
import { GlobalErrorListeners } from "@/components/diagnostics/GlobalErrorListeners";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MediBilbao Salud - Nutricion",
  description:
    "Tu nutricionista contigo entre sesiones: plan claro, registro rapido y revision semanal.",
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#2f8f6a",
};

/**
 * Root Layout of the application.
 * Configures fonts, metadata, global error listeners, and error boundaries.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  // Get preferred locale from cookies, default to 'es'
  const locale = cookieStore.get("mb_locale")?.value ?? "es";

  return (
    <html lang={locale}>
      <body className={`${manrope.variable} ${newsreader.variable} ${geistMono.variable} antialiased`}>
        <GlobalErrorListeners />
        {/* Error Boundary ensures that client-side crashes don't break the entire app UI */}
        <ClientErrorBoundary>{children}</ClientErrorBoundary>
      </body>
    </html>
  );
}
