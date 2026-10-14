/*
  Linha do tempo da estadia (ordem f1b437bb, Pacote Clareza UX6, item a) — regra pura, sem banco.
  Mostra ao inquilino (e ao proprietário) Entrada, Conferência de entrada e Saída, cada uma com dia e
  horário. O horário vem do cadastro do imóvel; sem ele, diz "a combinar" em vez de inventar.
*/
import { JANELA_ENTRADA_HORAS } from "./conferencia.ts";

export interface EtapaEstadia {
  chave: "entrada" | "conferencia" | "saida";
  titulo: string;
  /** yyyy-mm-dd */
  dia: string;
  horario: string;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;
const A_COMBINAR = "horário a combinar";

/** "2026-11-01" → "01 nov". */
export function formatarDiaCurto(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d} ${MESES[Number(m) - 1] ?? ""}`.trim();
}

function horario(valor: string | null | undefined, prefixo: string): string {
  const v = (valor ?? "").trim();
  return HORA_RE.test(v) ? `${prefixo} ${v}` : A_COMBINAR;
}

function somarHoras(diaISO: string, horas: number): string {
  return new Date(new Date(`${diaISO}T00:00:00Z`).getTime() + horas * 3600_000).toISOString().slice(0, 10);
}

export function montarLinhaDoTempo(p: {
  inicio: string | null;
  fim: string | null;
  checkinAfter: string | null;
  checkoutBefore: string | null;
}): EtapaEstadia[] {
  if (!p.inicio || !p.fim || !DIA_RE.test(p.inicio) || !DIA_RE.test(p.fim)) return [];
  return [
    { chave: "entrada", titulo: "Entrada", dia: p.inicio, horario: horario(p.checkinAfter, "a partir das") },
    {
      chave: "conferencia",
      titulo: "Conferência de entrada",
      dia: somarHoras(p.inicio, JANELA_ENTRADA_HORAS),
      horario: "prazo para registrar e responder",
    },
    { chave: "saida", titulo: "Saída", dia: p.fim, horario: horario(p.checkoutBefore, "até as") },
  ];
}
