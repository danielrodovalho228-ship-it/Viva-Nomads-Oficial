import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Qualificação do imóvel",
  description: "Confirme que o imóvel está pronto e regular para a locação mobiliada e some pontos para o selo Pronto para Morar.",
  robots: { index: false, follow: false },
};

export default function QualificarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
