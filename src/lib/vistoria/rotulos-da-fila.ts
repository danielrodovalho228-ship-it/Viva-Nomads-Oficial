/*
  E1158 (ORDENS-DUET 658 e 659, sub-pontos 15 e 23) — os tipos da fila da equipe, com o rótulo de cada um. A tela
  (/admin/avaliadores, "Fila da equipe") e o e-mail aos admins dizem o item pelo MESMO rótulo. Os prazos saem das
  constantes do laudo (`laudo.ts`) — nunca da caução, que tem uma constante com o mesmo nome e outro sentido.
  PURO (node --test), sem imports @/.
*/
import { PRAZO_DEVOLUCAO_DIAS } from "./laudo.ts";
import { SEM_AVALIADOR_ELEGIVEL } from "./rotulos-do-pedido.ts";

export const ROTULO_FILA: Record<string, string> = {
  sem_avaliador: `Pedido ${SEM_AVALIADOR_ELEGIVEL}`,
  // E1177 (texto do coordenador): a contestação pede um avaliador diferente do primeiro, e a cidade não tem outro.
  contestacao_sem_avaliador: "Contestação sem segundo avaliador na cidade — a equipe decide",
  avaliacao_teste: "Avaliação de teste a marcar e revisar",
  suspensao_automatica: "Suspensão automática antiga (não é mais criada)",
  revisao_criterio: "Critério público de qualidade atingido: rever com o avaliador (direito de resposta)",
  proposta_descredenciamento: "Proposta de descredenciamento",
  laudo_atrasado: "Laudo não enviado no prazo combinado",
  ressalva_vencida: "Ressalva vencida: avaliar abrir verificação",
  devolucao_vencida: `Devolução da contestação não confirmada em ${PRAZO_DEVOLUCAO_DIAS} dias`,
  seguranca_grave: "Segurança grave a acompanhar",
};
export const rotuloDaFila = (tipo: string): string => ROTULO_FILA[tipo] ?? tipo;

/**
 * O corpo do e-mail "novo item na fila" aos admins: diz o tipo do item que entrou, pelo rótulo da tela. Sem o tipo
 * (o modelo da matriz), diz só que há um item novo — sem enumerar tipos, que a lista ficava sempre incompleta.
 */
export const corpoDoAvisoDaFila = (tipo?: string): string => (tipo ? `Há um item novo na fila da avaliação de imóveis: ${rotuloDaFila(tipo)}.` : "Há um item novo na fila da avaliação de imóveis.");
