/*
  Linha do tempo da estadia (ordem f1b437bb, Pacote Clareza UX6, item a) — regra pura, sem banco.
  Mostra ao inquilino (e ao proprietário) Entrada, Conferência de entrada e Saída, cada uma com dia e
  horário. E1230: o horário de entrada vem das instruções do contrato (o leitor único, já com a porta das duas
  assinaturas); sem ele, diz "a combinar" em vez de inventar. A saída diz "horário a combinar com o proprietário".
*/
import { prazoConferenciaEntrada, prazoConferenciaSaida, textoPrazoConferencia } from "./conferencia.ts";
import { ETIQUETA_BRASILIA, diaBRT } from "./datas-brasilia.ts";
import { saidaPeloFim } from "./texto-do-periodo.ts";
import { HORARIO_SAIDA_A_COMBINAR } from "./estadia/hora-da-entrada.ts";

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
  // Prompt 61-A: o horário do imóvel diz o fuso, como o prazo da conferência ("…, horário de Brasília").
  return HORA_RE.test(v) ? `${prefixo} ${v}, ${ETIQUETA_BRASILIA}` : A_COMBINAR;
}

export function montarLinhaDoTempo(p: {
  inicio: string | null;
  fim: string | null;
  /** E1230: a hora de entrada já resolvida (as instruções do contrato, e a porta das duas assinaturas). */
  checkinAfter: string | null;
  /**
   * E1238 (ORDEM-DUET 1207): o prazo de cada conferência vem PRONTO do servidor (o gravado quando ela nasceu, ou a mesma
   * regra com a hora das instruções de entrada — janela-conferencia.ts). Sem ele, a regra sem hora (23:59).
   */
  prazoEntradaEm?: string | null;
  prazoSaidaEm?: string | null;
}): EtapaEstadia[] {
  if (!p.inicio || !p.fim || !DIA_RE.test(p.inicio) || !DIA_RE.test(p.fim)) return [];
  const prazo = p.prazoEntradaEm ? new Date(p.prazoEntradaEm) : prazoConferenciaEntrada({ inicio: p.inicio, checkinAfter: null });
  const prazoSaida = p.prazoSaidaEm ? new Date(p.prazoSaidaEm) : prazoConferenciaSaida({ fim: p.fim });
  return [
    { chave: "entrada", titulo: "Entrada", dia: p.inicio, horario: horario(p.checkinAfter, "a partir das") },
    {
      chave: "conferencia",
      titulo: "Conferência de entrada",
      dia: diaBRT(prazo) ?? p.inicio,
      horario: textoPrazoConferencia(prazo),
      prazo: prazo?.toISOString(),
    },
    // E1089: a etapa "Saída" é o dia da SAÍDA (o dia seguinte à última noite gravada), a mesma data da proposta.
    { chave: "saida", titulo: "Saída", dia: saidaPeloFim(p.fim) || p.fim, horario: HORARIO_SAIDA_A_COMBINAR },
    // Prompt 56: a conferência de saída também tem prazo (48 h depois da saída), da fonte única prazoConferenciaSaida.
    {
      chave: "conferencia_saida",
      titulo: "Conferência de saída",
      dia: diaBRT(prazoSaida) ?? (saidaPeloFim(p.fim) || p.fim),
      horario: textoPrazoConferencia(prazoSaida),
      prazo: prazoSaida?.toISOString(),
    },
  ];
}
