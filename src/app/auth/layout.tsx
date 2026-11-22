import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Entrar ou criar conta",
  description: "Entre na sua conta Viva Nomads ou crie uma — proprietários e moradores de imóveis mobiliados.",
  robots: { index: false, follow: false },
};

// E1030 (era o D-V8): as telas de /auth ficam fora do layout público e do painel, que são quem abre o marco principal
// (o elemento main) nos outros lugares. A casca abre-o para todas, uma vez; cada tela continua a ocupar a altura toda.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
