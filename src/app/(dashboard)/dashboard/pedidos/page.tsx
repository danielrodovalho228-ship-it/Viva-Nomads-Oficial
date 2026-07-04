import {
  getMeusPedidos,
  getRespostasRecebidas,
  getNotifPrefs,
} from "@/lib/data/pedidos-actions";
import { PedidosClient } from "./pedidos-client";

export default async function MeusPedidosPage() {
  const [pedidos, respostas, prefs] = await Promise.all([
    getMeusPedidos(),
    getRespostasRecebidas(),
    getNotifPrefs(),
  ]);
  return <PedidosClient pedidos={pedidos} respostas={respostas} prefs={prefs} />;
}
