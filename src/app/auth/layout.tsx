import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Entrar ou criar conta",
  description: "Entre na sua conta Viva Nomads ou crie uma — proprietários e inquilinos de imóveis mobiliados.",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
