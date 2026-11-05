/*
  E562 (Relay 67): o prazo do contrato para o documento da ZapSign sai em DIAS — os da proposta aceita (a mesma fonte do
  registro do contrato e da taxa); sem proposta, os meses do Fechamento × 30. Os meses que ainda vão ao documento são
  DERIVADOS dos dias (para cima: 43 dias → 2), nunca o número que o navegador mandou. Puro (sem alias "@").
*/
import { mesesDeReferencia } from "./estadia-em-dias.ts";
import { periodoPorExtenso } from "./precos.ts";

export function prazoDoContratoEmDias(p: { diasAcordados: number | null; mesesDoFechamento: number }): { dias: number; meses: number; texto: string } {
  const dias = p.diasAcordados && p.diasAcordados > 0 ? Math.round(p.diasAcordados) : Math.round(p.mesesDoFechamento) * 30;
  return { dias, meses: mesesDeReferencia(dias), texto: periodoPorExtenso(dias) };
}
