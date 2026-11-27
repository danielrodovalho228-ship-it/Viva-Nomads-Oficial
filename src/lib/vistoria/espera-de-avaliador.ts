/*
  E1177 (ORDENS-DUET 773, 778 e 780; decisão do coordenador) — o estado vazio HONESTO da escolha do avaliador. Antes, toda
  lista vazia dizia "a Viva avisa quando houver um para você escolher" — mesmo quando a regra impedia que houvesse. Agora
  cada motivo de lista vazia tem o seu texto, e a promessa do aviso só aparece quando não há nenhum avaliador que atenda a
  cidade. Nenhum estado promete o que a regra impede.
  PURO (node --test), sem imports @/. FONTE ÚNICA: o bloco do dono, a troca de avaliador, os e-mails e as mensagens das
  ações leem daqui.
*/
import { PRAZO_EQUIPE_CONTESTACAO_DIAS_UTEIS, diasUteis } from "./prazos.ts";
import type { MotivoForaDaEscolha, TipoPedido } from "./regras.ts";

/** Por que o dono não tem ninguém para escolher neste pedido. */
export type MotivoDaEspera = "sem_avaliador_na_cidade" | "contestacao_sem_segundo" | "ja_escolhidos" | "independencia" | "indisponiveis" | "varios";

/**
 * O pedido em que a lista só tem o avaliador da avaliação anterior (a exceção da alternância). Não é lista vazia: o dono
 * pode escolhê-lo, ou esperar — a rotina continua a procurar outro e avisa quando houver.
 */
export const SO_O_ANTERIOR = "so_o_anterior";
/** O que a coluna vistoria_pedidos.motivo_da_espera guarda (vazio = há lista comum para escolher). */
export type EstadoDaEspera = MotivoDaEspera | typeof SO_O_ANTERIOR;

const FAMILIA: Record<MotivoForaDaEscolha, Exclude<MotivoDaEspera, "sem_avaliador_na_cidade" | "contestacao_sem_segundo" | "varios">> = {
  ja_designado: "ja_escolhidos",
  relacao_declarada: "independencia",
  servico_12_meses: "independencia",
  avaliacao_anterior: "independencia",
  // Fora da contestação este motivo não acontece; na contestação o caso tem texto próprio (abaixo).
  primeira_da_contestacao: "independencia",
  suspenso: "indisponiveis",
  nao_ativo: "indisponiveis",
  conta_teste: "indisponiveis",
  fora_do_piloto: "indisponiveis",
  // Outra cidade nem chega à lista dos que atendem a cidade.
  outra_cidade: "indisponiveis",
};

/**
 * O motivo da lista vazia, a partir do que impede cada avaliador que atende a cidade (`fora`: os impedidos e os que o
 * piloto deixou de fora). Sem ninguém: a cidade não tem avaliador. Na contestação com quem fez a 1ª avaliação: falta um
 * segundo avaliador. Nos outros casos, a família do impedimento; famílias diferentes juntas não escolhem uma e calam a
 * outra ("varios").
 */
export function motivoDaEspera(tipo: TipoPedido, fora: readonly MotivoForaDaEscolha[]): MotivoDaEspera {
  if (!fora.length) return "sem_avaliador_na_cidade";
  if (tipo === "contestacao" && fora.includes("primeira_da_contestacao")) return "contestacao_sem_segundo";
  const familias = new Set(fora.map((m) => FAMILIA[m]));
  return familias.size === 1 ? [...familias][0] : "varios";
}

const A_EQUIPE_FOI_AVISADA = "A equipe da Viva foi avisada.";

/** O texto que o dono lê em cada caso. Só o primeiro promete o aviso: é o único em que a regra não o impede. */
export const TEXTO_DA_ESPERA: Record<MotivoDaEspera, string> = {
  sem_avaliador_na_cidade: "Ainda não há avaliador disponível na sua cidade. A Viva avisa você assim que houver um.",
  contestacao_sem_segundo: `Sua contestação precisa de um avaliador diferente do primeiro. Ainda não há outro na sua cidade, então a equipe da Viva assumiu o seu pedido e responde em até ${diasUteis(PRAZO_EQUIPE_CONTESTACAO_DIAS_UTEIS)}.`,
  ja_escolhidos: `Os avaliadores da sua cidade já foram escolhidos neste pedido e não continuam nele. ${A_EQUIPE_FOI_AVISADA}`,
  independencia: `Os avaliadores da sua cidade não podem avaliar este imóvel pelas regras de independência. ${A_EQUIPE_FOI_AVISADA}`,
  indisponiveis: `Os avaliadores da sua cidade não estão disponíveis para este pedido agora. ${A_EQUIPE_FOI_AVISADA}`,
  varios: `Os avaliadores da sua cidade não podem seguir com este pedido agora. ${A_EQUIPE_FOI_AVISADA}`,
};

/**
 * O texto da espera a partir do que está gravado no pedido. O pedido que já esperava antes desta regra ainda não tem o
 * motivo (a rotina grava-o no tique seguinte): até lá lê o texto que não promete nada.
 */
export function textoDaEspera(motivo: string | null | undefined): string {
  return (TEXTO_DA_ESPERA as Record<string, string>)[motivo ?? ""] ?? TEXTO_DA_ESPERA.varios;
}

/** O que a lista vazia diz quando o avaliador escolhido sai do pedido e não sobra mais ninguém (troca, recusa, silêncio). */
export const SEM_OUTRO_AVALIADOR = `Não há outro avaliador disponível agora. ${A_EQUIPE_FOI_AVISADA}`;

/** O cartão do avaliador que só voltou à lista pela exceção da alternância (texto do coordenador). */
export const TEXTO_MESMO_AVALIADOR = "Mesmo avaliador da avaliação anterior. É o único disponível na sua cidade agora. Você pode escolher ele ou esperar outro avaliador.";

/** O que o pedido guarda sobre a escolha: se a lista está vazia (`aguardando`) e porquê (`motivo`). */
export interface EstadoDaEscolha {
  aguardando: boolean;
  motivo: EstadoDaEspera | null;
}

/**
 * O estado da escolha a partir de quem o dono pode escolher (`sugeridos`) e do que impede os outros (`fora`).
 *  • há alguém que não seja o da avaliação anterior → lista comum;
 *  • só há o da avaliação anterior → a lista tem o cartão dele e o pedido continua a procurar outro (SO_O_ANTERIOR);
 *  • ninguém → lista vazia, com o motivo.
 */
export function estadoDaEscolha(tipo: TipoPedido, sugeridos: readonly { mesmoDaAnterior?: true }[], fora: readonly MotivoForaDaEscolha[]): EstadoDaEscolha {
  if (!sugeridos.length) return { aguardando: true, motivo: motivoDaEspera(tipo, fora) };
  return { aguardando: false, motivo: sugeridos.every((a) => a.mesmoDaAnterior === true) ? SO_O_ANTERIOR : null };
}

/** Por que o dono é avisado: a lista vazia abriu, ou chegou outro avaliador para quem esperava com o da anterior. */
export type AvisoAoDono = "lista_abriu" | "chegou_outro";

/**
 * O aviso que cumpre a promessa da tela. Só nas duas passagens em que o dono estava à espera e passou a ter o que
 * esperava: a lista vazia deixou de estar vazia; ou, com o cartão do avaliador anterior, apareceu outro avaliador.
 */
export function avisoAoDono(antes: { aguardando: boolean; motivo: string | null }, depois: { aguardando: boolean; motivo: string | null }): AvisoAoDono | null {
  if (depois.aguardando) return null;
  if (antes.aguardando) return "lista_abriu";
  return antes.motivo === SO_O_ANTERIOR && depois.motivo === null ? "chegou_outro" : null;
}
