import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { SITE_URL, SITE_NAME } from "@/lib/site";

// Tipografia única do site (Atualização 18): Inter para títulos e corpo,
// variando apenas o peso. Desenhada para telas — sem corte de descidas/acentos.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Viva Nomads — Locação mobiliada por temporada, de 30 a 180 dias",
    template: "%s · Viva Nomads",
  },
  description:
    "Apartamentos mobiliados e prontos para morar, por temporada de 30 a 180 dias. Contrato com validade jurídica e inquilino verificado.",
  keywords: [
    "locação por temporada",
    "imóvel mobiliado mensal",
    "aluguel 30 dias",
    "apartamento mobiliado pronto para morar",
    "Viva Nomads",
  ],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: SITE_NAME,
    url: SITE_URL,
  },
  // Site novo: declara explicitamente que pode ser indexado/seguido (boa prática).
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: { canonical: "/" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full scroll-smooth`}>
      <body className="min-h-full flex flex-col bg-surface text-ink">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
