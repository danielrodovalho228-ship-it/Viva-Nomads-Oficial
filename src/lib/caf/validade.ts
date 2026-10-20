/*
  Validade da identidade (CAF) — decisão do Daniel em 18/10 (prompt 22, item 5): o laudo vale 12 MESES, a pessoa faz
  no máximo 1 consulta a cada 12 meses, e troca de NOME ou CPF obriga a verificar de novo (regra no banco, 0164: o
  laudo em vigor deixa de valer e a cota é liberada).
*/
export const CAF_VALIDADE_MESES = 12;
/** Janela da cota de consulta (1 por pessoa), em segundos: 365 dias. */
export const CAF_JANELA_CONSULTA_S = 365 * 24 * 60 * 60;

/** Fim da validade de um laudo feito em `agora`: mesmo dia, 12 meses depois (29/02 → 28/02 ou 01/03 pelo calendário). */
export function validadeDoLaudo(agora: Date): Date {
  const fim = new Date(agora.getTime());
  fim.setUTCMonth(fim.getUTCMonth() + CAF_VALIDADE_MESES);
  return fim;
}

export const TEXTO_VALIDADE_CAF = "Vale por 12 meses (ou até você trocar o nome ou o CPF do cadastro).";
