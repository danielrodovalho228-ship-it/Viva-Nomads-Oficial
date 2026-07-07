import type { Metadata } from "next";
import { getPedidosParaProprietario, getMinhasRespostas } from "@/lib/data/pedidos-actions";
import { PedidosProprietarioClient } from "@/app/(public)/pedidos/pedidos-prop-client";

export const metadata: Metadata = {
  title: "Pedidos de moradia",
  robots: { index: false, follow: false },
};

/**
 * Visão do PROPRIETÁRIO dos Pedidos de Moradia — AGORA dentro da casca do
 * dashboard (grupo (dashboard) → DashboardShell + AuthGuard). Antes o menu
 * apontava para /pedidos (rota do grupo (public)), que abria "solta", sem menu
 * nem topo (bug 0.4). O conteúdo é o mesmo mural, só que na área logada.
 */
export default async function PedidosCidadePage() {
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
