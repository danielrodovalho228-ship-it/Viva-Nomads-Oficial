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
/** "90/10" — o nome da regra da divisão. */
const DIVISAO = `${Math.round((1 - TAXA_SERVICO_PARCEIRO) * 100)}/${Math.round(TAXA_SERVICO_PARCEIRO * 100)}`;

export const TEXTO_TAXA_SERVICO_PARCEIROS = `Taxa de serviço: ${PCT_TAXA_SERVICO_PARCEIROS} sobre o valor do serviço, para todas as categorias. Quando o pagamento pela plataforma estiver ativo, o valor é dividido na origem: ${PCT_PARCEIRO_RECEBE} direto ao parceiro e ${PCT_TAXA_SERVICO_PARCEIROS} à Viva. A Viva não guarda o dinheiro.`;

/** A regra escrita no cadastro do parceiro (Prompt 43, item 1): a divisão 90/10, sem número escondido. */
export const TEXTO_REGRA_90_10 = `Regra ${DIVISAO}: de cada serviço, ${PCT_PARCEIRO_RECEBE} ficam com você e ${PCT_TAXA_SERVICO_PARCEIROS} são a taxa de serviço da Viva.`;

/** E1111: o rótulo da linha da taxa nas telas do pedido ("Taxa de serviço da Viva (10%)"). */
export const ROTULO_TAXA_SERVICO_VIVA = `Taxa de serviço da Viva (${PCT_TAXA_SERVICO_PARCEIROS})`;

/** E1111: a divisão na origem, dita ao parceiro, quando o pagamento pela plataforma estiver ativo. */
export const TEXTO_DIVISAO_NA_ORIGEM = `Quando o pagamento pela plataforma estiver ativo, o valor é dividido na origem: ${PCT_PARCEIRO_RECEBE} vai direto para você e ${PCT_TAXA_SERVICO_PARCEIROS} para a Viva.`;

export const TEXTO_PAGAMENTO_PARCEIROS_EM_BREVE = "Pagamento pela plataforma em breve.";

/** O texto da taxa com o aviso "em breve" enquanto a chave PAGAMENTO_PARCEIROS_ATIVO estiver desligada. */
export function textoTaxaServicoParceiros(pagamentoAtivo: boolean): string {
  return pagamentoAtivo ? TEXTO_TAXA_SERVICO_PARCEIROS : `${TEXTO_TAXA_SERVICO_PARCEIROS} ${TEXTO_PAGAMENTO_PARCEIROS_EM_BREVE}`;
}
