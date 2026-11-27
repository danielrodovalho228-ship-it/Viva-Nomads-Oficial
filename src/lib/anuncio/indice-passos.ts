/*
  E602: o índice de passos do assistente de cadastro — os 10 passos, clicáveis, com o estado de cada um. Sai da MESMA
  lista de conferência da Revisão (conferenciaAssistente, que vem da prontidão — a única regra de "pode publicar"), sem
  regra nova:
    • "atual"   — o passo aberto;
    • "falta"   — tem item obrigatório pendente para publicar (aparece mesmo em passo ainda não visitado);
    • "feito"   — já visitado e sem pendência;
    • "a-fazer" — ainda não visitado e sem pendência obrigatória.
  O Passo 10 ("Revise e publique") fica "falta" enquanto houver pendência das seções de "Antes de publicar".
  PURO. Roda: node --test src/lib/anuncio/e602-indice-passos.test.ts
*/
import { ETAPAS_ASSISTENTE, type IdEtapaAssistente, type ItemConferencia } from "./assistente-dez-etapas.ts";

export type EstadoPassoIndice = "atual" | "falta" | "feito" | "a-fazer";

export interface PassoIndice {
  /** Número do passo (1..10), como o rodapé "Passo N de 10". */
  n: number;
  /** Posição no assistente (0..9) — a do `ETAPA`. */
  pos: number;
  id: IdEtapaAssistente;
  titulo: string;
  estado: EstadoPassoIndice;
  /** O que falta para publicar (vazio quando nada). */
  faltam: string[];
}

export function indicePassos(
  conf: { itens: Pick<ItemConferencia, "etapa" | "ok" | "faltam">[]; pendentesNaRevisao: string[] },
  atual: number,
  visitadoAte: number,
): PassoIndice[] {
  return ETAPAS_ASSISTENTE.map((e) => {
    const pos = e.n - 1;
    const item = conf.itens.find((i) => i.etapa === e.n);
    const faltam = e.id === "revisao" ? conf.pendentesNaRevisao : item && !item.ok ? item.faltam : [];
    const estado: EstadoPassoIndice = pos === atual ? "atual" : faltam.length > 0 ? "falta" : pos <= Math.max(visitadoAte, atual) ? "feito" : "a-fazer";
    return { n: e.n, pos, id: e.id, titulo: e.titulo, estado, faltam };
  });
}

/** Texto curto do estado (leitores de tela e o `title` do botão). */
export const ROTULO_ESTADO_PASSO: Record<EstadoPassoIndice, string> = {
  atual: "passo atual",
  falta: "falta algo para publicar",
  feito: "feito",
  "a-fazer": "a fazer",
};
