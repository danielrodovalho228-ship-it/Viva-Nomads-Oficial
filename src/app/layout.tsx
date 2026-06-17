import type { Metadata } from "next";
import { Syne, DM_Sans } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vivanomads.com.br"),
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
    siteName: "Viva Nomads",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${syne.variable} ${dmSans.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-surface text-ink">{children}</body>
    </html>
  );
}
