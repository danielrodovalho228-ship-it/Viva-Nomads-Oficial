/*
  E756 (Phoenix/RELATORIO-004, C5): o cartão da busca mostrava "R$ X em 2 meses" = 2 × o total do mês, sem as limpezas de preparação e de
  saída, enquanto a página do imóvel (e o fechamento) somam 2 mensalidades + limpeza de preparação + limpeza de saída — no ube-003,
  2 × R$ 4.100 + R$ 450 + R$ 250 = R$ 8.900, e o cartão dizia R$ 8.200. O total do cartão passa a ser EXATAMENTE o da página (a mesma
  função, `estadiaDoImovel`), e o cartão diz em uma linha o que há além das mensalidades. PURO.
*/
import { estadiaDoImovel, precoDoImovel } from "./precos.ts";
import { resumoEmMeses } from "./cartao-preco.ts";

export interface EstadiaNoCartao {
  /** "R$ 8.900 em 2 meses" */
  texto: string;
  total: number;
  meses: number;
  /** "Inclui limpeza de preparação e limpeza de saída" — null quando o total é só mensalidades. */
  composicao: string | null;
}

/** O total da estadia do cartão com N > 1 meses; com 1 mês (ou sem total), null (o cartão usa a linha de 1 mês de sempre). */
export function estadiaNoCartao(p: Parameters<typeof estadiaDoImovel>[0], meses: number): EstadiaNoCartao | null {
  if (!(meses > 1)) return null;
  const e = estadiaDoImovel(p, meses);
  if (!e) return null;
  const unicos = precoDoImovel(p, meses).unicos.map((u) => u.rotulo.toLowerCase());
  return {
    texto: resumoEmMeses(e.total, e.meses),
    total: e.total,
    meses: e.meses,
    composicao: unicos.length ? `Inclui ${unicos.join(" e ")}` : null,
  };
}
