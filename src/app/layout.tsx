import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import { PushApp } from "@/components/app/push-app";
import { AppModeBridge } from "@/components/app/app-mode-bridge";
import { LinksDoApp } from "@/components/app/links-do-app";
import { OrigemVisita } from "@/components/app/origem-visita";
import { VivaChatFlutuante } from "@/components/ajuda/viva-chat";
import { APP_PREPAINT_SCRIPT } from "@/lib/app-mode";
import { descricaoHome } from "@/lib/seo/meta-descricao";

// Tipografia única do site (Atualização 18): Inter para títulos e corpo,
// variando apenas o peso. Desenhada para telas — sem corte de descidas/acentos.
const inter = localFont({
  variable: "--font-inter",
  src: [
    { path: "./fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/inter-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  // Banner "Abrir no app" do iPhone (Safari) — só quando o app estiver na App Store.
  ...(process.env.NEXT_PUBLIC_IOS_APP_ID ? { itunes: { appId: process.env.NEXT_PUBLIC_IOS_APP_ID } } : {}),
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Imóveis mobiliados de 30 a 180 dias · Viva Nomads",
    template: "%s · Viva Nomads",
  },
  description: descricaoHome(),
  keywords: [
    "estadias de 30 a 180 dias",
    "imóvel mobiliado mensal",
    "locação mobiliada 30 a 180 dias",
    "imóvel mobiliado pronto para morar",
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
          <AppModeBridge />
          <PushApp />
          <OrigemVisita />
          <VivaChatFlutuante />
          <LinksDoApp />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
