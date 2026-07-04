import { getMeusPedidos, getRespostasRecebidas } from "@/lib/data/pedidos-actions";
import { PedidosClient } from "./pedidos-client";

export default async function MeusPedidosPage() {
  const [pedidos, respostas] = await Promise.all([getMeusPedidos(), getRespostasRecebidas()]);
  return <PedidosClient pedidos={pedidos} respostas={respostas} />;
}
