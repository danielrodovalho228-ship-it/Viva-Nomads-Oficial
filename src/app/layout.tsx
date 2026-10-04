import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { NativeBridge } from "@/components/native/native-bridge";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import { AppModeBridge } from "@/components/app/app-mode-bridge";
import { APP_PREPAINT_SCRIPT } from "@/lib/app-mode";

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
  // Sem canonical global aqui: antes, TODAS as páginas herdavam `canonical: "/"`
  // e se declaravam cópia da home. Sem canonical declarado, o Google usa a própria
  // URL como canônica (auto-referente) — o certo. As páginas que precisam de um
  // canonical explícito (/, /imoveis/[id], /cidades/[cidade]) o definem no próprio
  // generateMetadata.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full scroll-smooth`} suppressHydrationWarning>
      <head>
        {/* Modo app (Android/iPhone): marca <html data-app> antes da 1ª pintura. */}
        <script dangerouslySetInnerHTML={{ __html: APP_PREPAINT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-surface text-ink">
        <AuthProvider>
          <NativeBridge />
          <AppModeBridge />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
