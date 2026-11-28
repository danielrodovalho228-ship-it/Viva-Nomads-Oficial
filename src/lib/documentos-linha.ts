/*
  E1067 — fusão do #4078 (ORDENS-DUET 1149, 1155 e 1194): a linha de um recibo na tela "Documentos do contrato".
  O número (ou "Recibo em preparação"), o TOTAL do registro (valor + encargos, lido pela fonte única
  componentesDoPagamento — ORDEM-DUET-1194) e o período em datas. Sem "mês", "meses" nem "dias": o documento já
  emitido tem o texto dele no PDF guardado, e a lista não diz uma segunda redacção ao lado. A caução não tem período.
  Puro.
*/
import { brl } from "./fiscal/documento.ts";

/** E1233: "01/05" — dia e mês, sem ano. */
function diaMes(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}` : iso;
}

/** E1233: a identificação do bloco, logo depois do número; sem bloco (registro antigo), nada — a caução, do contrato. */
function identificacao(r: { tipo: string; bloco?: number | null; parte?: number | null }): string | null {
  if (r.tipo === "caucao") return r.bloco ? `Caução do bloco ${r.bloco}` : "Caução do contrato";
  if (!r.bloco) return null;
  return (r.parte ?? 1) > 1 ? `Bloco ${r.bloco}, registro complementar` : `Bloco ${r.bloco}`;
}

/**
 * E1233 (ORDEM-DUET 1208): número · identificação do bloco · TOTAL · período (dd/mm, sem ano). Sem número, "Recibo em
 * preparação". A caução não tem período. "Registro complementar" vem da coluna parte (> 1).
 */
export function textoLinhaRecibo(r: { tipo: string; numero: string | null; total: number; inicio: string | null; fim: string | null; bloco?: number | null; parte?: number | null }): string {
  const periodo = r.tipo !== "caucao" && r.inicio && r.fim ? `${diaMes(r.inicio)} a ${diaMes(r.fim)}` : null;
  return [r.numero ?? "Recibo em preparação", identificacao(r), brl(r.total), periodo].filter(Boolean).join(" · ");
}

/**
 * E1241 (ORDEM-DUET 1237): o registro SEM documento que nunca o terá (aguardando a confirmação, ou anulado antes dela):
 * a mesma gramática sem o número e sem "Recibo em preparação" — bloco · TOTAL · período.
 */
export function textoLinhaSemDocumento(r: { tipo: string; total: number; inicio: string | null; fim: string | null; bloco?: number | null; parte?: number | null }): string {
  const periodo = r.tipo !== "caucao" && r.inicio && r.fim ? `${diaMes(r.inicio)} a ${diaMes(r.fim)}` : null;
  return [identificacao(r), brl(r.total), periodo].filter(Boolean).join(" · ");
}
