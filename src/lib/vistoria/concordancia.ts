/*
  E1173 (ORDENS-DUET 751 e 753) — o "Não concordo" do morador do imóvel ocupado. PURO.
  Opção A, sem migração: a recusa LIMPA a data proposta e MANTÉM o pedido de concordância (concordancia_pedida_em).
  Essa combinação só é lida aqui, por `concordanciaRecusada`: as telas dos três lados e o cartão da conversa usam-na.
  A recusa não é um reagendamento (os reagendou_* não mudam): a data seguinte é um "Agendar" novo.
  Roda: node --test src/lib/vistoria/e1173-moradora-pode-nao-concordar.test.ts
*/

export interface EstadoDaConcordancia {
  status: string;
  ocupado: boolean;
  agendadoPara: string | null | undefined;
  concordanciaPedidaEm: string | null | undefined;
  concordanciaEm: string | null | undefined;
}

/**
 * O morador disse "Não concordo" à última data proposta, e ainda não há data nova. Só vale no pedido com avaliador
 * ("designado"): o pedido devolvido ao dono não tem data a recusar (e a devolução limpa a concordância).
 */
export function concordanciaRecusada(p: EstadoDaConcordancia): boolean {
  return p.status === "designado" && p.ocupado === true && !p.agendadoPara && !!p.concordanciaPedidaEm && !p.concordanciaEm;
}

/**
 * E1175: a data proposta espera a concordância do morador (o pedido com avaliador, ocupado, com data e sem resposta).
 * Nunca é verdadeira junto com `concordanciaRecusada` (essa é sem data). A Central conta os dois estados na mesma linha.
 */
export function aEsperaDaConcordancia(p: EstadoDaConcordancia): boolean {
  return p.status === "designado" && p.ocupado === true && !!p.agendadoPara && !p.concordanciaEm;
}

/** O que a recusa grava no pedido. Não escreve concordancia_pedida_em (fica), nem o status, nem o reagendamento. */
export function gravacaoDaRecusa(agoraISO: string): { agendado_para: null; concordancia_em: null; lembrete_d1_em: null; atualizado_em: string } {
  return { agendado_para: null, concordancia_em: null, lembrete_d1_em: null, atualizado_em: agoraISO };
}

/** A troca de avaliador devolve o pedido ao dono sem data: a concordância pedida ao morador deixa de existir com ela. */
export const LIMPEZA_DA_CONCORDANCIA = { concordancia_pedida_em: null, concordancia_em: null } as const;

// Os textos são os aprovados nas ORDENS-DUET 757 e 759.
/** O botão do morador, ao lado do "Concordo com a visita em …". */
export const ROTULO_NAO_CONCORDO = "Não posso nesta data";
/** O que o morador lê depois de recusar: na página dele, no cartão da conversa e na resposta da ação. */
export const TEXTO_RECUSA_PARA_O_MORADOR = "Avisamos o proprietário e o avaliador. A nova data chega por aqui.";
/** O que o dono lê enquanto não há data nova (ele também propõe datas, pelo formulário do bloco dele). */
export const TEXTO_RECUSA_PARA_O_DONO = "O morador não pode na data proposta. Proponha outra data ao avaliador.";
/** O que o avaliador lê enquanto não propõe a data nova. */
export const TEXTO_RECUSA_PARA_O_AVALIADOR = "O morador não pode na data proposta. Proponha outra data.";
