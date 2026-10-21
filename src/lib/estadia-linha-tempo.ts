/*
  Linha do tempo da estadia (ordem f1b437bb, Pacote Clareza UX6, item a) — regra pura, sem banco.
  Mostra ao inquilino (e ao proprietário) Entrada, Conferência de entrada e Saída, cada uma com dia e
  horário. O horário vem do cadastro do imóvel; sem ele, diz "a combinar" em vez de inventar.
*/
import { prazoConferenciaEntrada, prazoConferenciaSaida, textoPrazoConferencia } from "./conferencia.ts";
import { diaBRT } from "./datas-brasilia.ts";

export interface EtapaEstadia {
  chave: "entrada" | "conferencia" | "saida" | "conferencia_saida";
  titulo: string;
  /** yyyy-mm-dd */
  dia: string;
  horario: string;
  /** Só na conferência: o instante do prazo (ISO), o mesmo da seção da conferência e do servidor. */
  prazo?: string;
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

export function montarLinhaDoTempo(p: {
  inicio: string | null;
  fim: string | null;
  checkinAfter: string | null;
  checkoutBefore: string | null;
}): EtapaEstadia[] {
  if (!p.inicio || !p.fim || !DIA_RE.test(p.inicio) || !DIA_RE.test(p.fim)) return [];
  // F2 (Prompt 35B): o prazo vem da fonte única — dia de início + horário de entrada, em Brasília, + 48 h.
  const prazo = prazoConferenciaEntrada({ inicio: p.inicio, checkinAfter: p.checkinAfter });
  const prazoSaida = prazoConferenciaSaida({ fim: p.fim, checkoutBefore: p.checkoutBefore });
  return [
    { chave: "entrada", titulo: "Entrada", dia: p.inicio, horario: horario(p.checkinAfter, "a partir das") },
    {
      chave: "conferencia",
      titulo: "Conferência de entrada",
      dia: diaBRT(prazo) ?? p.inicio,
      horario: textoPrazoConferencia(prazo),
      prazo: prazo?.toISOString(),
    },
    { chave: "saida", titulo: "Saída", dia: p.fim, horario: horario(p.checkoutBefore, "até as") },
    // Prompt 56: a conferência de saída também tem prazo (48 h depois da saída), da fonte única prazoConferenciaSaida.
    {
      chave: "conferencia_saida",
      titulo: "Conferência de saída",
      dia: diaBRT(prazoSaida) ?? p.fim,
      horario: textoPrazoConferencia(prazoSaida),
      prazo: prazoSaida?.toISOString(),
    },
  ];
}
