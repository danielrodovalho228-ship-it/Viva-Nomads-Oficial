import { redirect } from "next/navigation";

/**
 * A visão do PROPRIETÁRIO dos Pedidos de Moradia agora mora DENTRO da casca do
 * dashboard, em /dashboard/pedidos-cidade (bug 0.4: aqui, no grupo (public),
 * ela abria "solta", sem menu nem topo). Mantemos a rota antiga como
 * redirecionamento para não quebrar links salvos.
 */
export default function PedidosLegacyRedirect() {
  redirect("/dashboard/pedidos-cidade");
}
