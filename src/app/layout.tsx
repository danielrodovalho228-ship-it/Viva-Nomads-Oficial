import type { Metadata } from "next";
import { Syne, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { SITE_URL, SITE_NAME } from "@/lib/site";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Viva Nomads — Locação mobiliada mensal para profissionais em transição",
    template: "%s · Viva Nomads",
  },
  description:
    "Locação de imóveis mobiliados por temporada de média duração (30 a 180 dias) para profissionais em transição. Não é Airbnb, não é QuintoAndar: locação mensal aceita em condomínios.",
  keywords: [
    "locação por temporada",
    "imóvel mobiliado mensal",
    "aluguel 30 dias",
    "moradia para profissionais em transição",
    "Viva Nomads",
  ],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: SITE_NAME,
    url: SITE_URL,
  },
  alternates: { canonical: "/" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${syne.variable} ${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-surface text-ink">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
