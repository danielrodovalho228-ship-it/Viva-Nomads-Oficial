/*
  E1183 (ORDEM-DUET-791) — de que imóvel e de que avaliador é o item da "Fila da equipe" (/admin/avaliadores).
  O item mostrava só o rótulo e o motivo. Os dados saem do próprio item (o avaliador, quando ele o traz) e do pedido dele
  (o imóvel e, se o item não disser, o avaliador do pedido). O formato é o que a Central já usa nas outras listas:
  "nº UDI-002 · Título do anúncio · VN-XXXXXX". O que a leitura não trouxe não se inventa.
  PURO (node --test), sem imports @/.
*/
import { identificacaoDoImovel } from "./pedido-avaliador.ts";

export interface ItemDaFila {
  pedido_id: string | null;
  avaliador_id: string | null;
}

export interface DadosDaFila {
  /** O pedido de cada item: o imóvel e o avaliador dele. */
  pedidos: ReadonlyMap<string, { property_id: string | null; avaliador_id: string | null }>;
  /** O número de credenciado de cada avaliador (id do credenciamento → "UDI-002"). */
  numeros: ReadonlyMap<string, string>;
  /** O título do anúncio de cada imóvel. */
  titulos: ReadonlyMap<string, string | null>;
}

/** Os pedidos a ler para identificar os itens da fila, sem repetição e na ordem em que aparecem. */
export function referenciasDaFila(fila: readonly ItemDaFila[]): { pedidos: string[] } {
  return { pedidos: [...new Set(fila.map((f) => f.pedido_id).filter((x): x is string => !!x))] };
}

/** "nº UDI-002 · Casa das Acácias · VN-0A1B2C" — ou só a parte que se conhece; `null` quando não há nada a dizer. */
export function identificacaoDoItemDaFila(item: ItemDaFila, dados: DadosDaFila): string | null {
  const pedido = item.pedido_id ? dados.pedidos.get(item.pedido_id) : undefined;
  // O avaliador que o próprio item traz vale mais do que o do pedido (a devolução é do 1º avaliador da contestação).
  const numero = dados.numeros.get(item.avaliador_id ?? pedido?.avaliador_id ?? "");
  const imovel = pedido?.property_id ? identificacaoDoImovel(dados.titulos.get(pedido.property_id), pedido.property_id) : null;
  const partes = [numero ? `nº ${numero}` : null, imovel].filter((x): x is string => !!x);
  return partes.length ? partes.join(" · ") : null;
}
