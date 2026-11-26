/*
  E1089 (coordenador, 22/11/2026) — FONTE ÚNICA do período de uma estadia como a pessoa o lê, em toda superfície
  (proposta, candidatura, contrato, estadia, calendários, e-mails, conferência de saída):

      Entrada DD/MM · Saída DD/MM · N diárias

  O período gravado é [entrada, entrada + dias): N dias = N noites. A SAÍDA é entrada + dias (a conta da proposta e da
  candidatura, E599). O fim gravado nos blocos do contrato é a ÚLTIMA NOITE (fim inclusivo, um dia antes da saída): se
  aparecer, chama-se "Última noite" — nunca "saída", "fim" ou o segundo termo de "X a Y".
  Só apresentação: não mexe em banco, blocos, valores nem no documento já assinado. PURO (node --test).
*/

export interface TextoDoPeriodo {
  /** AAAA-MM-DD — o dia da entrada. */
  entrada: string;
  /** AAAA-MM-DD — o dia da SAÍDA (entrada + dias). */
  saida: string;
  /** AAAA-MM-DD — a última noite (o fim inclusivo gravado nos blocos): um dia antes da saída. */
  ultimaNoite: string;
  /** Noites da estadia (= dias cobrados). */
  diarias: number;
  /** "Entrada 23/11/2026 · Saída 24/12/2026 · 31 diárias" */
  linha: string;
  /** "Entrada 23/11 · Saída 24/12 · 31 diárias" (cartões e listas, onde o ano já está à vista ou não cabe). */
  linhaCurta: string;
}

export const ROTULO_ENTRADA = "Entrada";
export const ROTULO_SAIDA = "Saída";
export const ROTULO_ULTIMA_NOITE = "Última noite";

const DIA = /^(\d{4})-(\d{2})-(\d{2})/;
const diaISO = (v: string | null | undefined): string | null => {
  const m = DIA.exec(String(v ?? "").trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};
const mais = (iso: string, dias: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};
const ddmmaaaa = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const ddmm = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** "31 diárias" / "1 diária". */
export const textoDiarias = (n: number): string => `${n} ${n === 1 ? "diária" : "diárias"}`;

/** O período a partir da entrada e dos dias da estadia. Sem entrada válida ou sem dias, null. */
export function textoDoPeriodo(p: { entrada: string | null | undefined; dias: number | null | undefined }): TextoDoPeriodo | null {
  const entrada = diaISO(p.entrada);
  const diarias = Math.round(Number(p.dias));
  if (!entrada || !Number.isFinite(diarias) || diarias < 1) return null;
  const saida = mais(entrada, diarias);
  return {
    entrada,
    saida,
    ultimaNoite: mais(entrada, diarias - 1),
    diarias,
    linha: `${ROTULO_ENTRADA} ${ddmmaaaa(entrada)} · ${ROTULO_SAIDA} ${ddmmaaaa(saida)} · ${textoDiarias(diarias)}`,
    linhaCurta: `${ROTULO_ENTRADA} ${ddmm(entrada)} · ${ROTULO_SAIDA} ${ddmm(saida)} · ${textoDiarias(diarias)}`,
  };
}

/**
 * O mesmo período a partir do que o contrato grava: a entrada e o FIM INCLUSIVO dos blocos (a última noite). A saída é
 * o dia seguinte a esse fim; as diárias, as noites entre a entrada e a saída. Fim antes da entrada ou sem data: null.
 */
export function periodoPeloFim(entrada: string | null | undefined, fimInclusivo: string | null | undefined): TextoDoPeriodo | null {
  const e = diaISO(entrada);
  const f = diaISO(fimInclusivo);
  if (!e || !f) return null;
  const dias = Math.round((Date.parse(`${f}T00:00:00Z`) - Date.parse(`${e}T00:00:00Z`)) / 86_400_000) + 1;
  return textoDoPeriodo({ entrada: e, dias });
}

/** Só a data de SAÍDA (AAAA-MM-DD) a partir do fim inclusivo gravado; "" sem data válida. */
export function saidaPeloFim(fimInclusivo: string | null | undefined): string {
  const f = diaISO(fimInclusivo);
  return f ? mais(f, 1) : "";
}

/** O mesmo período a partir da entrada e da SAÍDA já calculada (proposta, candidatura: saída = entrada + dias). */
export function periodoPelaSaida(entrada: string | null | undefined, saida: string | null | undefined): TextoDoPeriodo | null {
  const e = diaISO(entrada);
  const s = diaISO(saida);
  if (!e || !s) return null;
  return textoDoPeriodo({ entrada: e, dias: Math.round((Date.parse(`${s}T00:00:00Z`) - Date.parse(`${e}T00:00:00Z`)) / 86_400_000) });
}

/** "24/12/2026" — a data de SAÍDA por extenso a partir do fim inclusivo gravado; "" sem data válida. */
export function saidaBRPeloFim(fimInclusivo: string | null | undefined): string {
  const s = saidaPeloFim(fimInclusivo);
  return s ? ddmmaaaa(s) : "";
}

