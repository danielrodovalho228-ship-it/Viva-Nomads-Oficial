/*
  Taxa de serviço dos PARCEIROS (complemento do Prompt 29, item 1 — reteste do #891): a taxa fixa por pedido dos
  fotógrafos saiu. Vale um percentual único para todas as categorias. FONTE ÚNICA do texto para o
  /admin/fotografos, as páginas públicas de parceiros e a Central de Ajuda. Puro (node --test).
*/

export const TEXTO_TAXA_SERVICO_PARCEIROS =
  "Taxa de serviço: 10% sobre o valor do serviço, para todas as categorias. Quando o pagamento pela plataforma estiver ativo, o valor é dividido na origem: 90% direto ao parceiro e 10% à Viva. A Viva não guarda o dinheiro.";

/** A regra escrita no cadastro do parceiro (Prompt 43, item 1): a divisão 90/10, sem número escondido. */
export const TEXTO_REGRA_90_10 = "Regra 90/10: de cada serviço, 90% ficam com você e 10% são a taxa de serviço da Viva.";

export const TEXTO_PAGAMENTO_PARCEIROS_EM_BREVE = "Pagamento pela plataforma em breve.";

/** O texto da taxa com o aviso "em breve" enquanto a chave PAGAMENTO_PARCEIROS_ATIVO estiver desligada. */
export function textoTaxaServicoParceiros(pagamentoAtivo: boolean): string {
  return pagamentoAtivo ? TEXTO_TAXA_SERVICO_PARCEIROS : `${TEXTO_TAXA_SERVICO_PARCEIROS} ${TEXTO_PAGAMENTO_PARCEIROS_EM_BREVE}`;
}
