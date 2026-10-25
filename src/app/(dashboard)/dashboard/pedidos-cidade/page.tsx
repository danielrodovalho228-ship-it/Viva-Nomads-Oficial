import type { Metadata } from "next";
import { Suspense } from "react";
import { getPedidosParaProprietario } from "@/lib/data/pedidos-actions";
import { PedidosDonoClient } from "./pedidos-dono-client";

export const metadata: Metadata = {
  title: "Pedidos de moradia",
  robots: { index: false, follow: false },
};

/**
 * Visão do PROPRIETÁRIO dos Pedidos de Moradia, dentro da casca do dashboard (a rota antiga /pedidos redireciona
 * para cá). Prompt 30, item 5: abas "Novos para você" · "Respondidos" · "Ignorados".
 */
export default async function PedidosCidadePage() {
  const { pedidos, myProperties } = await getPedidosParaProprietario();
  return (
    <Suspense fallback={<div className="min-h-[20rem]" aria-busy="true" />}>
      <PedidosDonoClient pedidos={pedidos} myProperties={myProperties} />
    </Suspense>
  );
}
