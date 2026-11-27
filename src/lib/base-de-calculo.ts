/*
  E1067 (ORDENS-DUET 1149 e 1154) — a frase da base de cálculo, tirada do Fechamento (closing-flow.tsx) sem mudar um
  carácter. O valor mensal chega JÁ FORMATADO por quem chama: o Fechamento passa reais inteiros (formatBRL); o recibo e
  a página do contrato, o formato dos documentos.
  ORDEM-DUET-1206: duas funções — contaDoPeriodo (a conta sozinha, que o recibo e a página do contrato põem entre
  parênteses depois do valor) e textoBaseDeCalculo (a frase do Fechamento, feita dela; só o Fechamento a usa):
    em dias  → "Base de cálculo (R$ X × N dias ÷ 30)"
    em meses → "Base de cálculo (R$ X × N mês/meses)"
*/
/** ORDEM-DUET-1206: a conta sozinha — "R$ X × N dias ÷ 30" ou "R$ X × N mês/meses". O recibo e a página do contrato
 * põem-na entre parênteses, logo depois do valor (a mesma gramática da conta em meses). */
export function contaDoPeriodo(mensal: string, duracao: { dias: number | null | undefined; meses: number }): string {
  const { dias, meses } = duracao;
  return dias ? `${mensal} × ${dias} dias ÷ 30` : `${mensal} × ${meses} ${meses === 1 ? "mês" : "meses"}`;
}

/** A frase do Fechamento (só ele a usa): "Base de cálculo (" + a conta + ")". */
export function textoBaseDeCalculo(mensal: string, duracao: { dias: number | null | undefined; meses: number }): string {
  return `Base de cálculo (${contaDoPeriodo(mensal, duracao)})`;
}
