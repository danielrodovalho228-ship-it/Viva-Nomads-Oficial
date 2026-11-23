/*
  E1101 (ORDEM-DUET-465) — de quem é a vez num pedido de avaliação e até quando. FONTE ÚNICA: o bloco do dono, a lista e
  a tela do pedido do avaliador, as ações e a rotina leem daqui. Antes cada um decidia por si, e o mesmo pedido mostrava
  ao dono "72 horas para aceitar" e ao avaliador, que já tinha proposto, um prazo de resposta vencido ou "aceito".
   • Sem proposta: a vez é do AVALIADOR, pelo prazo que ele declarou (padrão 24 h), contado da escolha.
   • Enviada a proposta: o relógio de resposta PARA. A vez é do DONO: 72 h, contadas da proposta.
   • Aceita a proposta (ou fora do "designado"): não há relógio.
   • O aceite do dono vale para todo pedido que o dono escolheu — também no piloto, onde a conta é de teste. Só a
     avaliação de teste do credenciamento (o admin designa; o dono não escolhe) segue sem aceite.
  Regras puras: sem banco, sem tela.
*/
import { dataHoraBRT } from "../datas-brasilia.ts";
import { PRAZO_DONO_ACEITAR_HORAS, PRAZO_RESPOSTA_PADRAO_HORAS } from "./escolha.ts";

export interface EstadoParaORelogio {
  status: string;
  /** A resposta do avaliador escolhido: null = ainda não respondeu; undefined = a designação não foi lida. */
  resposta: string | null | undefined;
  designadoEm: string | null;
  propostaEm: string | null;
  propostaAceitaEm: string | null;
  /** O prazo de resposta que o avaliador declarou, em horas; sem ele, o padrão. */
  prazoRespostaHoras?: number | null;
  /** O pedido precisa do aceite do dono (precisaDoAceiteDoDono). */
  precisaDoAceite: boolean;
}

export interface Relogio {
  vez: "avaliador" | "dono";
  /** O instante em que o prazo acaba (ISO). */
  ate: string;
  vencido: boolean;
  horas: number;
}

const HORA = 3_600_000;

/** Só a avaliação de teste do credenciamento dispensa o aceite: é de teste E não foi o dono que escolheu o avaliador. */
export function precisaDoAceiteDoDono(p: { teste: boolean; escolhidoEm: string | null }): boolean {
  return !(p.teste && !p.escolhidoEm);
}

function relogio(vez: Relogio["vez"], desde: string, horas: number, agora: Date): Relogio | null {
  const t = Date.parse(desde);
  if (!Number.isFinite(t)) return null;
  const fim = t + horas * HORA;
  return { vez, ate: new Date(fim).toISOString(), vencido: agora.getTime() >= fim, horas };
}

/** De quem é a vez e até quando; null quando não há prazo a correr. */
export function relogioDoPedido(p: EstadoParaORelogio, agora: Date): Relogio | null {
  if (p.status !== "designado") return null;
  // A proposta gravada manda: com ela, o relógio de resposta parou, o que quer que a resposta lida diga.
  if (p.propostaEm) {
    if (p.propostaAceitaEm || !p.precisaDoAceite) return null;
    return relogio("dono", p.propostaEm, PRAZO_DONO_ACEITAR_HORAS, agora);
  }
  if (p.resposta !== null || !p.designadoEm) return null;
  const horas = Number.isFinite(p.prazoRespostaHoras) && Number(p.prazoRespostaHoras) > 0 ? Number(p.prazoRespostaHoras) : PRAZO_RESPOSTA_PADRAO_HORAS;
  return relogio("avaliador", p.designadoEm, horas, agora);
}

/** O contador do avaliador: "Responda em 23 h 10 min". Vencido: a rotina devolve o pedido ao dono. */
export function textoDoPrazoDeResposta(r: Relogio, agora: Date): string {
  const resta = Date.parse(r.ate) - agora.getTime();
  if (r.vencido || resta <= 0) return "Prazo de resposta vencido: o pedido volta ao proprietário, que escolhe de novo.";
  const horas = Math.floor(resta / HORA);
  const min = Math.floor((resta % HORA) / 60_000);
  return `Responda em ${horas} h ${String(min).padStart(2, "0")} min`;
}

/** O que o avaliador lê depois de propor: até quando o dono pode aceitar. */
export function textoDoPrazoDeAceite(r: Relogio): string {
  return `O proprietário tem até ${dataHoraBRT(r.ate)} para aceitar: ${r.horas} horas depois da proposta. Sem o aceite, o pedido volta para ele escolher de novo.`;
}

/** Propor num pedido cuja designação já tem resposta: o motivo certo (nunca "o prazo passou" para quem já propôs). */
export function erroAoPropor(resposta: string | null | undefined, prazoRespostaHoras: number): string {
  if (resposta === "aceita") return "A proposta deste pedido já foi enviada.";
  if (resposta === "recusada") return "Você recusou este pedido; ele voltou ao proprietário.";
  if (resposta === "expirada") return `O prazo de ${prazoRespostaHoras} ${prazoRespostaHoras === 1 ? "hora" : "horas"} para responder já passou.`;
  return "Este pedido não está mais com você.";
}
