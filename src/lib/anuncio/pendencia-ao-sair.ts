/*
  E612: o "Continuar" dos Passos 5 e 6 avança mesmo com bloqueador de publicação pendente (padrão mínimo 0/12, tipo de
  entrada) — e a trava só aparecia no Publicar. O avanço continua livre; ao sair do passo com bloqueador, o passo
  seguinte abre com um resumo do que ficou pendente lá (e um atalho para voltar). Fonte única: a conferência do
  assistente (conferenciaAssistente), a mesma da Revisão. PURO.
*/
import type { ItemConferencia } from "./assistente-dez-etapas.ts";

export interface PendenciaAoSair {
  /** Número do passo (1..10) deixado com pendência. */
  passo: number;
  titulo: string;
  faltam: string[];
}

/** O que ficou pendente no passo `etapaIndice` (índice 0..9, o mesmo do `step`) — null quando nada bloqueia. */
export function pendenciaAoSair(itens: ItemConferencia[], etapaIndice: number): PendenciaAoSair | null {
  const item = itens.find((i) => i.etapa === etapaIndice + 1);
  if (!item || item.ok || item.faltam.length === 0) return null;
  return { passo: item.etapa, titulo: item.rotulo, faltam: item.faltam };
}

/** O título do aviso: "Ficou pendente no Passo 5 — Comodidades". */
export const tituloPendenciaAoSair = (p: PendenciaAoSair) => `Ficou pendente no Passo ${p.passo} — ${p.titulo}`;
/** O fecho do aviso: o avanço é livre, a pendência só segura o Publicar. */
export const NOTA_PENDENCIA_AO_SAIR = "Você pode seguir; sem isso o anúncio não publica.";
