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

/**
 * E655: sem proposta ligada à candidatura, o contrato respeita a JANELA EXATA da candidatura (10/01–24/02 = 45 dias), não
 * os meses arredondados para cima. O servidor não confia no navegador: os `diasPedidos` valem só se forem exatamente os
 * dias da janela gravada na candidatura e estiverem na faixa permitida; senão null (cai nos meses do Fechamento).
 */
export function diasDaCandidaturaParaContrato(p: {
  inicio: string | null | undefined;
  fim: string | null | undefined;
  diasPedidos: number | null | undefined;
  valido: (dias: number) => boolean;
}): number | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const de = String(p.inicio ?? "").slice(0, 10);
  const ate = String(p.fim ?? "").slice(0, 10);
  if (!iso.test(de) || !iso.test(ate) || ate <= de) return null;
  const dias = Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
  if (!Number.isInteger(p.diasPedidos) || p.diasPedidos !== dias || !p.valido(dias)) return null;
  return dias;
}
