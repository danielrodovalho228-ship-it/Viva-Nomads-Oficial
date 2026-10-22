import {
  getMeusPedidos,
  getRespostasRecebidas,
  getNotifPrefs,
} from "@/lib/data/pedidos-actions";
import { PedidosClient } from "./pedidos-client";
import { FalarComAViva } from "@/components/ajuda/falar-com-a-viva";
import { RespostaRapida } from "@/components/ajuda/resposta-rapida";

export default async function MeusPedidosPage() {
  const [pedidos, respostas, prefs] = await Promise.all([
    getMeusPedidos(),
    getRespostasRecebidas(),
    getNotifPrefs(),
  ]);
  return (
    <>
      <PedidosClient pedidos={pedidos} respostas={respostas} prefs={prefs} />
      <RespostaRapida faqId="inquilino-paga" />
      <FalarComAViva />
    </>
  );
}
