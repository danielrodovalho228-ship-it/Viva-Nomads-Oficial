/*
  Taxa de serviço dos PARCEIROS (complemento do Prompt 29, item 1 — reteste do #891): a taxa fixa por pedido dos
  fotógrafos saiu. Vale um percentual único para todas as categorias. FONTE ÚNICA do texto para o
  /admin/fotografos, as páginas públicas de parceiros e a Central de Ajuda. Puro (node --test).
  E1111 (ORDEM-DUET-494): os números dos textos saem do valor da fonte (TAXA_SERVICO_PARCEIRO, lib/parceiros/regras.ts):
  nenhum "10%" ou "90%" escrito à mão — mudar a taxa lá muda o texto aqui e nas telas que o usam.
*/
import { TAXA_SERVICO_PARCEIRO } from "../lib/parceiros/regras.ts";

const pct = (t: number) => `${Math.round(t * 100)}%`;
/** "10%" — a taxa de serviço da Viva sobre o valor do serviço. */
export const PCT_TAXA_SERVICO_PARCEIROS = pct(TAXA_SERVICO_PARCEIRO);
/** "90%" — o que fica com o parceiro. */
export const PCT_PARCEIRO_RECEBE = pct(1 - TAXA_SERVICO_PARCEIRO);
/**
 * E1151 (ORDEM-DUET-641/645): a divisão na origem tem UMA redacção, a canónica — com "A Viva não guarda o dinheiro." —
 * dita ao parceiro ("você") ou sobre ele ("o parceiro": a tela do pedido do dono e a Ajuda).
 */
export function textoDivisaoNaOrigem(para: "você" | "o parceiro"): string {
  return `Quando o pagamento pela plataforma estiver ativo, o valor é dividido na origem: ${PCT_PARCEIRO_RECEBE} vai direto para ${para} e ${PCT_TAXA_SERVICO_PARCEIROS} para a Viva. A Viva não guarda o dinheiro.`;
}

export const TEXTO_TAXA_SERVICO_PARCEIROS = `Taxa de serviço: ${PCT_TAXA_SERVICO_PARCEIROS} sobre o valor do serviço, para todas as categorias. ${textoDivisaoNaOrigem("o parceiro")}`;

/** E1111: o rótulo da linha da taxa nas telas do pedido ("Taxa de serviço da Viva (10%)"). */
export const ROTULO_TAXA_SERVICO_VIVA = `Taxa de serviço da Viva (${PCT_TAXA_SERVICO_PARCEIROS})`;

/** E1111/E1151: a divisão na origem, dita ao parceiro — a mesma frase na secção de regras e no formulário de /parceiros. */
export const TEXTO_DIVISAO_NA_ORIGEM = textoDivisaoNaOrigem("você");

/** E1151: a única constante do aviso "em breve" (a cópia PAGAMENTO_EM_BREVE de regras.ts saiu). */
export const TEXTO_PAGAMENTO_PARCEIROS_EM_BREVE = "Pagamento pela plataforma em breve.";

/** Regras claras dos parceiros (Prompt 31a, item 8), nas páginas públicas — E1151: os percentuais vêm das constantes. */
export const REGRAS_CLARAS = [
  "Você combina e agenda tudo pelas mensagens da Viva.",
  `Taxa de serviço: ${PCT_TAXA_SERVICO_PARCEIROS} sobre o valor do serviço, para todas as categorias. Você só paga quando há serviço contratado.`,
  TEXTO_DIVISAO_NA_ORIGEM,
] as const;

/**
 * E1158 (2): o texto da taxa dito AO parceiro ("vai direto para você") — a área logada do avaliador. O texto de baixo
 * fala SOBRE o parceiro, para o dono, a equipe e as páginas públicas.
 */
export function textoTaxaServicoAoParceiro(pagamentoAtivo: boolean): string {
  const base = `Taxa de serviço: ${PCT_TAXA_SERVICO_PARCEIROS} sobre o valor do serviço, para todas as categorias. ${TEXTO_DIVISAO_NA_ORIGEM}`;
  return pagamentoAtivo ? base : `${base} ${TEXTO_PAGAMENTO_PARCEIROS_EM_BREVE}`;
}

/** O texto da taxa com o aviso "em breve" enquanto a chave PAGAMENTO_PARCEIROS_ATIVO estiver desligada. */
export function textoTaxaServicoParceiros(pagamentoAtivo: boolean): string {
  return pagamentoAtivo ? TEXTO_TAXA_SERVICO_PARCEIROS : `${TEXTO_TAXA_SERVICO_PARCEIROS} ${TEXTO_PAGAMENTO_PARCEIROS_EM_BREVE}`;
}
