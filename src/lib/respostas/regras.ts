/*
  Prompt 55-E2 — respostas rápidas e mensagens programadas do dono. PURO (node --test src/lib/respostas/regras.test.ts).

  Respostas rápidas: até 20 por dono (título + texto), inseridas na conversa com 1 toque. O filtro de contato vale para
  o texto salvo: telefone, e-mail, link de mensageria, rede social ou documento BLOQUEIAM ao salvar e ao enviar (não
  mascaram — a resposta salva é reutilizada muitas vezes). A "mensagem para quem vai pedir" do anúncio (61-B) entra como
  a primeira resposta, com o mesmo filtro.

  Mensagens programadas por estadia, a partir de 3 modelos: 7 dias antes da entrada, no dia da entrada e no dia da
  saída. O dono edita o texto; o cron envia na conversa da estadia no horário do modelo, nunca entre 22h e 7h. Aditivo
  que muda as datas reagenda o que ainda não saiu; contrato encerrado cancela.
*/

import { guardContactInfo } from "../messages/contact-guard.ts";
import { emSilencio, proximoEnvioPermitido } from "../notifications/silencio.ts";

export const LIMITE_RESPOSTAS = 20;
export const TITULO_MAX = 60;
export const TEXTO_MAX = 1000;

export const MSG_CONTATO_BLOQUEADO =
  "Tire telefone, e-mail, link de WhatsApp/Telegram, rede social ou documento do texto: a conversa fica registrada na Viva.";
export const MSG_LIMITE_RESPOSTAS = `Você já tem ${LIMITE_RESPOSTAS} respostas salvas. Apague uma para salvar outra.`;

/** O texto traz contato direto ou documento? (o mesmo filtro do chat, aqui para BLOQUEAR em vez de mascarar). */
export function temContato(texto: string): boolean {
  const g = guardContactInfo(texto);
  return g.masked || g.documento;
}

export type Validacao<T> = { ok: true; valor: T } | { ok: false; erro: string };

export function validarResposta(e: { titulo: string; texto: string }, jaSalvas: number, editando = false): Validacao<{ titulo: string; texto: string }> {
  const titulo = (e.titulo ?? "").trim();
  const texto = (e.texto ?? "").trim();
  if (!titulo) return { ok: false, erro: "Dê um título curto à resposta." };
  if (titulo.length > TITULO_MAX) return { ok: false, erro: `Título com até ${TITULO_MAX} caracteres.` };
  if (!texto) return { ok: false, erro: "Escreva o texto da resposta." };
  if (texto.length > TEXTO_MAX) return { ok: false, erro: `Texto com até ${TEXTO_MAX} caracteres.` };
  if (temContato(titulo) || temContato(texto)) return { ok: false, erro: MSG_CONTATO_BLOQUEADO };
  if (!editando && jaSalvas >= LIMITE_RESPOSTAS) return { ok: false, erro: MSG_LIMITE_RESPOSTAS };
  return { ok: true, valor: { titulo, texto } };
}

export interface RespostaRapida {
  id: string;
  titulo: string;
  texto: string;
  /** A "mensagem para quem vai pedir" do anúncio (61-B): editada no anúncio, não aqui. */
  doAnuncio?: boolean;
}

export const ID_MENSAGEM_DO_ANUNCIO = "anuncio";
export const TITULO_MENSAGEM_DO_ANUNCIO = "Mensagem para quem vai pedir";

/** As respostas da conversa: a mensagem do anúncio primeiro (se passar no filtro), depois as salvas. */
export function respostasDaConversa(salvas: readonly RespostaRapida[], mensagemDoAnuncio: string | null | undefined): RespostaRapida[] {
  const m = (mensagemDoAnuncio ?? "").trim();
  const primeira = m && !temContato(m) ? [{ id: ID_MENSAGEM_DO_ANUNCIO, titulo: TITULO_MENSAGEM_DO_ANUNCIO, texto: m, doAnuncio: true }] : [];
  return [...primeira, ...salvas.slice(0, LIMITE_RESPOSTAS)];
}

// ── Mensagens programadas ──────────────────────────────────────────────────────────────────────────────────────

export type Quando = "7_dias_antes" | "entrada" | "saida";
export const QUANDOS: readonly Quando[] = ["7_dias_antes", "entrada", "saida"];

export const MODELOS: Record<Quando, { rotulo: string; hora: number; texto: string }> = {
  "7_dias_antes": {
    rotulo: "7 dias antes da entrada",
    hora: 10,
    texto: "Olá! Falta uma semana para a sua entrada. Se precisar de alguma informação antes de chegar, me escreva por aqui.",
  },
  entrada: {
    rotulo: "No dia da entrada",
    hora: 9,
    texto: "Bom dia! Hoje é o dia da sua entrada. As instruções de chegada estão na página da estadia. Qualquer dúvida, estou por aqui.",
  },
  saida: {
    rotulo: "No dia da saída",
    hora: 9,
    texto: "Bom dia! Hoje é o dia da sua saída. Obrigado pela estadia. Lembre de fazer a conferência de saída na página da estadia.",
  },
};

export const ehQuando = (q: unknown): q is Quando => typeof q === "string" && (QUANDOS as readonly string[]).includes(q);

const H = 3_600_000;
const BRT = -3 * H;

/** Entrada e saída da estadia: o 1º início e o último fim dos blocos válidos (renovação recusada fica fora). */
export function datasDaEstadia(blocos: readonly { inicio: string; fim: string; status?: string }[]): { entrada: string; saida: string } | null {
  const v = blocos.filter((b) => b.status !== "nao_aceito");
  if (!v.length) return null;
  return { entrada: v.map((b) => b.inicio).sort()[0], saida: v.map((b) => b.fim).sort().at(-1)! };
}

/** Quando o modelo sai: dia do modelo, na hora do modelo (Brasília); se cair no silêncio, às 7h seguintes. */
export function enviarEm(quando: Quando, datas: { entrada: string; saida: string }): Date {
  const base = quando === "saida" ? datas.saida : datas.entrada;
  const [a, m, d] = base.slice(0, 10).split("-").map(Number);
  const dia = quando === "7_dias_antes" ? d - 7 : d;
  return proximoEnvioPermitido(new Date(Date.UTC(a, m - 1, dia, MODELOS[quando].hora) - BRT));
}

/** Passou mais de 1 dia da hora marcada sem sair (cron parado, estadia criada em cima da data): não envia atrasado. */
export const ATRASO_MAXIMO_MS = 24 * H;

export interface Programada {
  enviar_em: string;
  enviada_em: string | null;
  cancelada_em: string | null;
  texto: string;
}

export type Decisao = { acao: "nada" } | { acao: "esperar" } | { acao: "enviar" } | { acao: "cancelar"; motivo: "contrato_encerrado" | "contato" | "vencida" };

/** O que o cron faz com a mensagem agora. Nunca envia entre 22h e 7h (Brasília). */
export function decidirEnvio(p: Programada, contratoAtivo: boolean, agora: Date): Decisao {
  if (p.enviada_em || p.cancelada_em) return { acao: "nada" };
  if (!contratoAtivo) return { acao: "cancelar", motivo: "contrato_encerrado" };
  const t = Date.parse(p.enviar_em);
  if (agora.getTime() < t) return { acao: "esperar" };
  if (agora.getTime() - t > ATRASO_MAXIMO_MS) return { acao: "cancelar", motivo: "vencida" };
  if (temContato(p.texto)) return { acao: "cancelar", motivo: "contato" };
  if (emSilencio(agora)) return { acao: "esperar" };
  return { acao: "enviar" };
}

/** Aditivo que mudou as datas: novo horário de cada programada que ainda não saiu nem foi cancelada. */
export function reagendar<T extends Programada & { id: string; quando: Quando }>(linhas: readonly T[], datas: { entrada: string; saida: string }): { id: string; enviar_em: string }[] {
  const out: { id: string; enviar_em: string }[] = [];
  for (const l of linhas) {
    if (l.enviada_em || l.cancelada_em) continue;
    const novo = enviarEm(l.quando, datas).toISOString();
    if (Date.parse(novo) !== Date.parse(l.enviar_em)) out.push({ id: l.id, enviar_em: novo });
  }
  return out;
}

export const ROTULO_MOTIVO: Record<string, string> = {
  dono: "Cancelada por você",
  contrato_encerrado: "Cancelada: contrato encerrado",
  contato: "Não enviada: o texto tinha contato direto",
  vencida: "Não enviada: a data passou",
};

/** "seg., 17/11 às 10h" no horário de Brasília. */
export function rotuloHorario(iso: string): string {
  const l = new Date(Date.parse(iso) + BRT);
  const dias = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];
  const dd = String(l.getUTCDate()).padStart(2, "0");
  const mm = String(l.getUTCMonth() + 1).padStart(2, "0");
  const min = l.getUTCMinutes();
  return `${dias[l.getUTCDay()]}, ${dd}/${mm} às ${l.getUTCHours()}h${min ? String(min).padStart(2, "0") : ""}`;
}
