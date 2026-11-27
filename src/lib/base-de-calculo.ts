/*
  E1067 (ORDENS-DUET 1149 e 1154) — a frase da base de cálculo, tirada do Fechamento (closing-flow.tsx) sem mudar um
  carácter. O valor mensal chega JÁ FORMATADO por quem chama: o Fechamento passa reais inteiros (formatBRL); o recibo e
  as páginas, o formato dos documentos.
    em dias  → "Base de cálculo (R$ X × N dias ÷ 30)"
    em meses → "Base de cálculo (R$ X × N mês/meses)"
*/
export function textoBaseDeCalculo(mensal: string, duracao: { dias: number | null | undefined; meses: number }): string {
  const { dias, meses } = duracao;
  return dias ? `Base de cálculo (${mensal} × ${dias} dias ÷ 30)` : `Base de cálculo (${mensal} × ${meses} ${meses === 1 ? "mês" : "meses"})`;
}
