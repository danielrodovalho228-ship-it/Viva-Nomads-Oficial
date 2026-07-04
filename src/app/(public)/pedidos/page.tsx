import type { Metadata } from "next";
import { getPedidosParaProprietario, getMinhasRespostas } from "@/lib/data/pedidos-actions";
import { PedidosProprietarioClient } from "./pedidos-prop-client";

export const metadata: Metadata = {
  title: "Pedidos de moradia — responda com seus imóveis",
  robots: { index: false, follow: false },
};

export default async function PedidosProprietarioPage() {
  const [{ pedidos, myProperties }, minhasRespostas] = await Promise.all([
    getPedidosParaProprietario(),
    getMinhasRespostas(),
  ]);
  return (
    <PedidosProprietarioClient
      pedidos={pedidos}
      myProperties={myProperties}
      minhasRespostas={minhasRespostas}
    />
  );
}
