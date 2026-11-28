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

/** Um lado da anulação (o documento, ou o pagamento): a data e o motivo; qualquer um pode faltar. */
export interface LadoDaAnulacao {
  anuladoEm?: string | null;
  motivo?: string | null;
}

/**
 * E1250 (ESPEC-E1250; ORDEM-DUET 1297): a linha da lista de Documentos está ANULADA quando há DATA de anulação — no
 * documento, ou no pagamento. O motivo passa a ser só o texto do selo: o do lado que tem a data (primeiro o documento,
 * depois o pagamento); sem letras, vazio. O motivo de um lado SEM data é ignorado (cura o "confirmado com motivo por
 * engano"). O texto do selo é o de textoDoSeloAnulado ("Anulado: {motivo}", ou "Anulado").
 */
export function anulacaoDaLinha(p: { documento?: LadoDaAnulacao | null; pagamento?: LadoDaAnulacao | null }): { anulada: boolean; motivo: string | null } {
  const comData = [p.documento, p.pagamento].filter((l): l is LadoDaAnulacao => !!l?.anuladoEm);
  if (comData.length === 0) return { anulada: false, motivo: null };
  const motivo = comData.map((l) => (l.motivo ?? "").trim()).find((m) => m.length > 0) ?? null;
  return { anulada: true, motivo };
}
