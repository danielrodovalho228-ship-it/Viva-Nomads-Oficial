/*
  Prompt 44 — PUSH SÓ PELA MATRIZ. PURO.
  notify() pergunta aqui, pela chave do evento, se o push sai agora, espera as 7h (silêncio) ou não sai:
    • evento sem canal "push" na matriz (src/config/matriz-notificacoes.ts) → nunca push (central + e-mail);
    • no silêncio (22h–7h), só segurança e prazo que vence no dia saem; o resto espera as 7h;
    • mensagem nova: push só se a pessoa não abriu a conversa nos últimos 10 min, agrupado por conversa
      ("3 mensagens novas de Ana"), sem o texto.
  O conteúdo do push nunca leva contato, sobrenome nem documento; valor só para quem é parte.
  Roda: node --test src/lib/notifications/regra-push.test.ts
*/
import { MATRIZ_NOTIFICACOES, type EventoNotificacao, type LinhaMatriz } from "../../config/matriz-notificacoes.ts";
import { emSilencio, furaOSilencio, proximoEnvioPermitido } from "./silencio.ts";

export type DecisaoPush = { tipo: "enviar" } | { tipo: "adiar"; ate: Date } | { tipo: "nao"; motivo: "fora_da_matriz" | "sem_push" | "conversa_aberta" };

/** A linha da matriz do evento (undefined = fora da matriz). */
function linha(evento: string): LinhaMatriz | undefined {
  return (MATRIZ_NOTIFICACOES as Record<string, LinhaMatriz>)[evento];
}

/** O evento tem canal "push" na matriz? Fora da matriz: nunca. */
export function eventoTemPush(evento: string): boolean {
  return !!linha(evento)?.canais.includes("push");
}

export const JANELA_CONVERSA_ABERTA_MIN = 10;

/** A pessoa abriu a conversa há menos de 10 min? (então ela está vendo: sem push). */
export function conversaAbertaRecente(abertaEm: string | null | undefined, agora: Date): boolean {
  if (!abertaEm) return false;
  const t = Date.parse(abertaEm);
  return Number.isFinite(t) && agora.getTime() - t < JANELA_CONVERSA_ABERTA_MIN * 60_000;
}

export function decisaoDoPush(p: {
  evento: EventoNotificacao | string;
  agora: Date;
  /** Prazo que vence no próprio dia (ex.: manutenção urgente): fura o silêncio. */
  prazoHoje?: boolean;
  /** Só para mensagem nova: quando o destinatário abriu esta conversa pela última vez. */
  conversaAbertaEm?: string | null;
}): DecisaoPush {
  const l = linha(String(p.evento));
  if (!l) return { tipo: "nao", motivo: "fora_da_matriz" };
  if (!l.canais.includes("push")) return { tipo: "nao", motivo: "sem_push" };
  if (l.categoria === "mensagens" && conversaAbertaRecente(p.conversaAbertaEm, p.agora)) return { tipo: "nao", motivo: "conversa_aberta" };
  if (emSilencio(p.agora) && !furaOSilencio({ seguranca: l.categoria === "seguranca", prazoHoje: p.prazoHoje })) {
    return { tipo: "adiar", ate: proximoEnvioPermitido(p.agora) };
  }
  return { tipo: "enviar" };
}

/** "3 mensagens novas de Ana" (só o primeiro nome; nunca o texto da mensagem). */
export function textoMensagensAgrupadas(qtd: number, nome: string | null | undefined): { title: string; body: string } {
  const primeiro = (nome ?? "").replace(/\S+@\S+/g, "").trim().split(/\s+/)[0] || "";
  const de = primeiro ? ` de ${primeiro}` : "";
  const n = Math.max(1, Math.floor(qtd) || 1);
  return { title: n === 1 ? `Nova mensagem${de}` : `${n} mensagens novas${de}`, body: "Abra a conversa para ler e responder." };
}

/** Chave de agrupamento: as mensagens da mesma conversa substituem o push anterior no aparelho. */
export function grupoDaConversa(conversationId: string): string {
  return `conversa:${conversationId}`;
}
