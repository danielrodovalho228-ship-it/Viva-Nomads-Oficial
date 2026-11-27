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
import { PRAZO_DONO_ACEITAR_HORAS } from "./escolha.ts";
import { horasDeResposta } from "./prazos.ts";

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
  return relogio("avaliador", p.designadoEm, horasDeResposta(p.prazoRespostaHoras), agora);
}

/**
 * E1142: a proposta que o dono já não pode aceitar — as 72 h dele passaram. É a conta do relógio acima, a mesma das
 * telas e da rotina (que corre de hora em hora): entre o fim do prazo e a rotina, o aceite é recusado em vez de gravado.
 */
export function aceiteForaDoPrazo(p: { propostaEm: string | null; teste: boolean; escolhidoEm: string | null }, agora: Date): boolean {
  const r = relogioDoPedido(
    { status: "designado", resposta: undefined, designadoEm: null, propostaEm: p.propostaEm, propostaAceitaEm: null, precisaDoAceite: precisaDoAceiteDoDono(p) },
    agora,
  );
  return r?.vez === "dono" && r.vencido;
}

/** E1142: o instante em que o prazo do dono para aceitar acaba (ISO); null sem proposta. */
export function fimDoPrazoDeAceite(propostaEm: string | null): string | null {
  const t = propostaEm ? Date.parse(propostaEm) : NaN;
  return Number.isFinite(t) ? new Date(t + PRAZO_DONO_ACEITAR_HORAS * HORA).toISOString() : null;
}

/** E1142: como a lista do avaliador chama a designação cuja proposta venceu sem o aceite (não é "sem resposta" dele). */
export const ROTULO_PROPOSTA_EXPIRADA = "Proposta expirada sem o aceite do proprietário";

/** E1146: como a lista do avaliador chama a designação cuja proposta o dono descartou (não é "Você recusou"). */
export const ROTULO_PROPOSTA_DESCARTADA = "Proposta recusada pelo proprietário";

/**
 * E1142: o que o dono lê junto do botão quando tenta aceitar fora do prazo. Texto aprovado na ORDEM-DUET-623: não diz
 * "escolha outro avaliador", que seria mentira numa cidade com um avaliador só; é a mesma frase que o avaliador lê.
 */
export const ERRO_ACEITE_FORA_DO_PRAZO = `O prazo de ${PRAZO_DONO_ACEITAR_HORAS} horas para aceitar esta proposta terminou. O pedido volta para você escolher de novo.`;

/** O contador do avaliador: "Responda em 23 h 10 min". Vencido: a rotina devolve o pedido ao dono. */
export function textoDoPrazoDeResposta(r: Relogio, agora: Date): string {
  const resta = Date.parse(r.ate) - agora.getTime();
  if (r.vencido || resta <= 0) return "Prazo de resposta vencido: o pedido volta ao proprietário, que escolhe de novo.";
  const horas = Math.floor(resta / HORA);
  const min = Math.floor((resta % HORA) / 60_000);
  return `Responda em ${horas} h ${String(min).padStart(2, "0")} min`;
}

const emHoras = (n: number) => `${n} ${n === 1 ? "hora" : "horas"}`;

/**
 * E1157: os textos do prazo de RESPOSTA nas telas leem o prazo que o avaliador declarou (antes diziam sempre o padrão,
 * 24 horas, também a quem declarou 48 ou 72). O rótulo serve às duas telas: a do avaliador e a da equipe.
 */
export function rotuloSemResposta(prazoRespostaHoras: number | null | undefined): string {
  return `Sem resposta em ${emHoras(horasDeResposta(prazoRespostaHoras))}`;
}

/** E1157: o histórico vazio do avaliador diz o que vai aparecer ali, com o prazo dele. */
export function textoDoHistoricoVazio(prazoRespostaHoras: number | null | undefined): string {
  return `Aqui ficam as avaliações que você concluiu, as que recusou, as que passaram de ${emHoras(horasDeResposta(prazoRespostaHoras))} sem resposta e as ausências registradas. Ainda não há nenhuma.`;
}

/** E1157 (achado 30): a lista do avaliador não foi lida — o prazo dele continua a correr. */
export function textoDasAvaliacoesNaoLidas(prazoRespostaHoras: number | null | undefined): string {
  return `Não foi possível carregar as suas avaliações agora. Recarregue a página em instantes; os pedidos com prazo de ${horasDeResposta(prazoRespostaHoras)} h continuam valendo.`;
}

/**
 * O que o avaliador lê depois de propor: até quando o dono pode aceitar.
 * E1142: com o prazo vencido, a tela diz que ele terminou — antes continuava a prometer o aceite "até" uma data passada.
 */
export function textoDoPrazoDeAceite(r: Relogio): string {
  if (r.vencido) return `O prazo do proprietário para aceitar a sua proposta terminou em ${dataHoraBRT(r.ate)}. Ela não pode mais ser aceita, e o pedido volta para ele escolher de novo.`;
  return `O proprietário tem até ${dataHoraBRT(r.ate)} para aceitar: ${r.horas} horas depois da proposta. Sem o aceite, o pedido volta para ele escolher de novo.`;
}

/**
 * E1147: o prazo do dono para aceitar a proposta já terminou. É o sinal das telas do dono na janela entre o fim das 72 h
 * e a rotina que devolve o pedido — a mesma conta de `aceiteForaDoPrazo`, que recusa o aceite; não espera a rotina.
 */
export function prazoDoAceiteTerminou(r: Relogio | null): boolean {
  return !!r && r.vez === "dono" && r.vencido;
}

/**
 * E1154: o que o DONO lê enquanto a proposta espera o aceite dele — o mesmo prazo e a mesma hora de fim que o avaliador
 * vê (textoDoPrazoDeAceite), do mesmo relógio. Antes o dono lia só "72 horas depois da proposta" e fazia a conta.
 * Sem prazo do dono a correr, a frase fica sem data.
 * E1147: com o prazo já terminado (a janela até a rotina devolver o pedido), o dono lê que ele terminou — a frase
 * aprovada, a mesma que a recusa do aceite devolve. Antes continuava a ler "Aceite em até 72 horas…".
 */
export function textoDoPrazoDeAceiteParaODono(r: Relogio | null): string {
  if (prazoDoAceiteTerminou(r)) return ERRO_ACEITE_FORA_DO_PRAZO;
  return fraseDoPrazoDeAceite(r && r.vez === "dono" && !r.vencido ? r.ate : null);
}

const fraseDoPrazoDeAceite = (ate: string | null) => `Aceite em até ${PRAZO_DONO_ACEITAR_HORAS} horas depois da proposta${ate ? `, até ${dataHoraBRT(ate)}` : ""}; passado o prazo, você escolhe outro avaliador.`;

/**
 * E1160: a mesma frase, só a partir do instante da proposta — para o e-mail que sai quando ela chega (o prazo acabou de
 * começar). Sem o instante (o modelo sem os fatos), a frase vai sem a data.
 */
export function textoDoPrazoDeAceiteDesdeAProposta(propostaEm: string | null | undefined): string {
  return fraseDoPrazoDeAceite(fimDoPrazoDeAceite(propostaEm ?? null));
}

/** Propor num pedido cuja designação já tem resposta: o motivo certo (nunca "o prazo passou" para quem já propôs). */
export function erroAoPropor(resposta: string | null | undefined, prazoRespostaHoras: number): string {
  if (resposta === "aceita") return "A proposta deste pedido já foi enviada.";
  if (resposta === "recusada") return "Você recusou este pedido; ele voltou ao proprietário.";
  if (resposta === "expirada") return `O prazo de ${prazoRespostaHoras} ${prazoRespostaHoras === 1 ? "hora" : "horas"} para responder já passou.`;
  return "Este pedido não está mais com você.";
}

/**
 * E1153: a leitura de confirmação do aceite (roteiro aprovado). FONTE ÚNICA: a resposta da ação do dono e o bloco
 * pós-aceite dos dois lados (o bloco do dono, a lista e a tela do pedido do avaliador).
 */
export const CONFIRMACAO_DO_ACEITE = "Proposta aceita. Combinem a data da visita.";

/**
 * E1153: o dono aceitou a proposta e a visita ainda não tem data — é enquanto isso que a confirmação fica à vista.
 * Marcada a data (ou saindo o pedido da escolha), a tela mostra a visita, e "combinem a data" já não vale.
 */
export function aceitoSemDataDeVisita(p: { status: string; propostaAceitaEm: string | null | undefined; agendadoPara: string | null | undefined }): boolean {
  return p.status === "designado" && !!p.propostaAceitaEm && !p.agendadoPara;
}
