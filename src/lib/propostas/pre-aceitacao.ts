/*
  E722 — PRÉ-ACEITAÇÃO de 72 horas (validada pelo coordenador, decisão do Daniel). PURO.
  Depois que a proposta é aceita, quem vai morar tem 72 horas CORRIDAS para concluir o contrato:
    • a data e a hora exatas do fim aparecem na tela (horário de Brasília);
    • o prazo nunca passa da data de entrada: se a entrada vier antes das 72 h, vale a entrada;
    • lembretes 24 h e 6 h antes do fim, respeitando o silêncio das 22h às 7h;
    • regra de corrida, por escrito: o primeiro a concluir o contrato fica com o imóvel;
    • vencido sem concluir, a pré-aceitação EXPIRA sem punição, e pode ser reaberta no máximo 2 vezes;
    • na reabertura a taxa congelada na pré-aceitação CONTINUA VALENDO (não recalcula) — decisão do Daniel.
  Roda: node --test src/lib/propostas/e722-pre-aceitacao.test.ts
*/
import { emSilencio, proximoEnvioPermitido, SILENCIO } from "../notifications/silencio.ts";

const H = 3_600_000;
const BRT = -3 * H;

export const PRAZO_PRE_ACEITACAO_HORAS = 72;
export const MAX_REABERTURAS = 2;
/** Quantas horas antes do fim sai cada lembrete. */
export const LEMBRETES_HORAS = [24, 6] as const;

export const TEXTO_REGRA_CORRIDA =
  "Regra de corrida: o primeiro a concluir o contrato fica com o imóvel. Se outra pessoa concluir antes, esta pré-aceitação perde a vez, sem penalidade.";
export const TEXTO_SEM_PUNICAO =
  "Se o prazo terminar sem o contrato concluído, a pré-aceitação expira sem punição: nada é cobrado nem anotado contra você. Ela pode ser reaberta até 2 vezes, e a taxa já congelada continua valendo.";
export const TEXTO_TAXA_CONTINUA =
  "Ao reabrir uma candidatura, a taxa congelada na pré-aceitação CONTINUA VALENDO, não recalcula.";

/** Meia-noite (início do dia) de uma data AAAA-MM-DD em Brasília, como instante. */
function inicioDoDiaBRT(dia: string): Date {
  const [a, m, d] = dia.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d) - BRT);
}

/** Fim da pré-aceitação: 72 h corridas do início, limitado pelo início do dia de entrada quando este vier antes. */
export function prazoDaPreAceitacao(inicio: Date, dataEntrada: string | null | undefined): Date {
  const fim = new Date(inicio.getTime() + PRAZO_PRE_ACEITACAO_HORAS * H);
  if (!dataEntrada || !/^\d{4}-\d{2}-\d{2}/.test(dataEntrada)) return fim;
  const entrada = inicioDoDiaBRT(dataEntrada);
  return entrada.getTime() < fim.getTime() ? entrada : fim;
}

/** O último instante permitido (fora do silêncio) até `limite`: se o limite cai no silêncio, 21:59 do dia anterior ao silêncio. */
function ultimoEnvioPermitidoAte(limite: Date): Date {
  if (!emSilencio(limite)) return limite;
  const l = new Date(limite.getTime() + BRT);
  const dia = l.getUTCHours() >= SILENCIO.inicio ? l.getUTCDate() : l.getUTCDate() - 1;
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), dia, SILENCIO.inicio) - BRT - 60_000);
}

export interface Lembrete {
  horasAntes: number;
  /** Quando o lembrete pode sair (nunca no silêncio de 22h às 7h, nunca depois do fim). */
  enviarEm: Date;
}

/**
 * Os lembretes de 24 h e 6 h. No silêncio, sai às 7h seguintes; se as 7h já passam do fim, sai às 21h59 anterior.
 * Janela curta demais (o instante nominal antes do início) não ganha o lembrete.
 */
export function lembretesDaPreAceitacao(inicio: Date, prazo: Date): Lembrete[] {
  const saida: Lembrete[] = [];
  for (const h of LEMBRETES_HORAS) {
    const nominal = new Date(prazo.getTime() - h * H);
    if (nominal.getTime() <= inicio.getTime()) continue;
    let quando = proximoEnvioPermitido(nominal);
    if (quando.getTime() >= prazo.getTime()) quando = ultimoEnvioPermitidoAte(nominal);
    if (quando.getTime() <= inicio.getTime()) continue;
    saida.push({ horasAntes: h, enviarEm: quando });
  }
  return saida;
}

export type EstadoPreAceitacao = { chave: "vigente"; horasRestantes: number } | { chave: "expirada" };

export function estadoDaPreAceitacao(prazo: Date, agora: Date): EstadoPreAceitacao {
  const ms = prazo.getTime() - agora.getTime();
  return ms > 0 ? { chave: "vigente", horasRestantes: Math.ceil(ms / H) } : { chave: "expirada" };
}

/** Pode reabrir? No máximo 2 reaberturas. */
export function podeReabrir(reaberturas: number): boolean {
  return Number.isInteger(reaberturas) && reaberturas >= 0 && reaberturas < MAX_REABERTURAS;
}

/**
 * Reabre a pré-aceitação: nova janela de 72 h (ainda limitada pela entrada), uma reabertura a mais, e a TAXA CONGELADA
 * SEGUE A MESMA — nunca recalcula. Devolve null se esgotou as reaberturas ou se a entrada já passou.
 */
export function reabrirPreAceitacao(p: { reaberturas: number; taxaCongelada: number | null; dataEntrada: string | null; agora: Date }): { reaberturas: number; taxaCongelada: number | null; prazo: Date } | null {
  if (!podeReabrir(p.reaberturas)) return null;
  const prazo = prazoDaPreAceitacao(p.agora, p.dataEntrada);
  if (prazo.getTime() <= p.agora.getTime()) return null;
  return { reaberturas: p.reaberturas + 1, taxaCongelada: p.taxaCongelada, prazo };
}

/** Data e hora exatas do fim, para a tela: "10/11/2026 às 14:30 (horário de Brasília)". */
export function textoDoPrazo(prazo: Date): string {
  const l = new Date(prazo.getTime() + BRT);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(l.getUTCDate())}/${dois(l.getUTCMonth() + 1)}/${l.getUTCFullYear()} às ${dois(l.getUTCHours())}:${dois(l.getUTCMinutes())} (horário de Brasília)`;
}
