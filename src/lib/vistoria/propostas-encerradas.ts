/*
  E1159 (ORDENS-DUET 658 e 679) — as propostas de avaliação que NÃO viraram visita sem ser por recusa do avaliador: a que
  expirou sem o aceite do dono (E1142, `proposta_expirada_em`) e a que o dono descartou (E1146, `proposta_descartada_em`).
  A equipe lê-as numa secção própria do painel das recusas, com o avaliador, o imóvel e quando. É só leitura: não conta
  no "Para decidir". ORDEM-DUET-735: cada entrada leva o dono do pedido, para a página separar as de conta de teste
  (bloco próprio, fora da lista de trabalho — a regra do E1163). PURO.
  Roda: node --test src/lib/vistoria/e1159-propostas-encerradas-na-central.test.ts
*/
import { DIAS_DA_JANELA_DE_RECUSAS } from "./telas-exibicao.ts";
import { ROTULO_PROPOSTA_DESCARTADA, ROTULO_PROPOSTA_EXPIRADA } from "./relogio-do-pedido.ts";

/** A janela é a mesma da lista das recusas (uma fonte só). */
export const TITULO_PROPOSTAS_ENCERRADAS = `Propostas expiradas ou descartadas (${DIAS_DA_JANELA_DE_RECUSAS} dias)`;
export const VAZIO_PROPOSTAS_ENCERRADAS = `Nenhuma proposta expirada ou descartada nos últimos ${DIAS_DA_JANELA_DE_RECUSAS} dias.`;

export type MotivoDaPropostaEncerrada = "expirada" | "descartada";

/** A linha da designação como a página a lê. */
export interface LinhaDaPropostaEncerrada {
  id: string;
  avaliador_id: string;
  proposta_expirada_em: string | null;
  proposta_descartada_em: string | null;
  vistoria_pedidos: { property_id: string | null; cidade: string | null; owner_id: string | null } | null;
}

export interface PropostaEncerrada {
  id: string;
  avaliadorId: string;
  motivo: MotivoDaPropostaEncerrada;
  /** Quando expirou (o fim do prazo do dono) ou quando o dono a descartou. */
  quando: string;
  propertyId: string | null;
  cidade: string;
  /** O dono do pedido: é por ele que a página sabe se a proposta é de conta de teste. */
  ownerId: string | null;
}

/** Os rótulos que a casa já tem para os dois casos (a tela do avaliador usa os mesmos). */
export function rotuloDaPropostaEncerrada(motivo: MotivoDaPropostaEncerrada): string {
  return motivo === "expirada" ? ROTULO_PROPOSTA_EXPIRADA : ROTULO_PROPOSTA_DESCARTADA;
}

/**
 * Junta as linhas lidas por cada coluna numa lista só: uma entrada por designação, com o motivo e a data que valem
 * (com as duas datas, a mais recente), só as de dentro da janela, da mais recente para a mais antiga.
 */
export function propostasEncerradas(linhas: readonly LinhaDaPropostaEncerrada[], desde: string, teto = Number.POSITIVE_INFINITY): PropostaEncerrada[] {
  const limite = Date.parse(desde);
  const porId = new Map<string, PropostaEncerrada>();
  for (const l of linhas) {
    if (porId.has(l.id)) continue;
    const datas: [MotivoDaPropostaEncerrada, string | null][] = [
      ["expirada", l.proposta_expirada_em],
      ["descartada", l.proposta_descartada_em],
    ];
    const validas = datas.filter((d): d is [MotivoDaPropostaEncerrada, string] => !!d[1] && Date.parse(d[1]) >= limite).sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]));
    if (!validas.length) continue;
    const [motivo, quando] = validas[0];
    porId.set(l.id, { id: l.id, avaliadorId: l.avaliador_id, motivo, quando, propertyId: l.vistoria_pedidos?.property_id ?? null, cidade: l.vistoria_pedidos?.cidade ?? "", ownerId: l.vistoria_pedidos?.owner_id ?? null });
  }
  return [...porId.values()].sort((a, b) => Date.parse(b.quando) - Date.parse(a.quando)).slice(0, teto);
}
