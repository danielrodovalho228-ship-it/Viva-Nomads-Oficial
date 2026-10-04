import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Publicar pedido de moradia",
  description:
    "Diga o que você precisa — cidade, data, prazo e orçamento — e receba respostas de proprietários com imóveis mobiliados compatíveis.",
  robots: { index: false, follow: true },
};

export default function PedidoNovoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
