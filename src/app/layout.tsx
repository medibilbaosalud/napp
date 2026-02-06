import type { Metadata } from "next";
import { Geist_Mono, Manrope, Newsreader } from "next/font/google";
import { cookies } from "next/headers";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = cookieStore.get("mb_locale")?.value ?? "es";
  return (
    <html lang={locale}>
      <body className={`${manrope.variable} ${newsreader.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
