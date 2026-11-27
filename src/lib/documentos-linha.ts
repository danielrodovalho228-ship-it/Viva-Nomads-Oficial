/*
  E1067 — fusão do #4078 (ORDENS-DUET 1149, 1155 e 1194): a linha de um recibo na tela "Documentos do contrato".
  O número (ou "Recibo em preparação"), o TOTAL do registro (valor + encargos, lido pela fonte única
  componentesDoPagamento — ORDEM-DUET-1194) e o período em datas. Sem "mês", "meses" nem "dias": o documento já
  emitido tem o texto dele no PDF guardado, e a lista não diz uma segunda redacção ao lado. A caução não tem período.
  Puro.
*/
import { brl, dataBR } from "./fiscal/documento.ts";

export function textoLinhaRecibo(r: { tipo: string; numero: string | null; total: number; inicio: string | null; fim: string | null }): string {
  const periodo = r.tipo !== "caucao" && r.inicio && r.fim ? ` · ${dataBR(r.inicio)} a ${dataBR(r.fim)}` : "";
  return `${r.numero ?? "Recibo em preparação"} · ${brl(r.total)}${periodo}`;
}
