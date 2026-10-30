/*
  E264-B — e-mails PROATIVOS (sugestões e novidades). PURO.
  Os cinco: imóvel novo para o pedido (pedido_imovel_novo), alerta de busca salva (saved_search_match), pedido de
  moradia compatível (pedido_compativel) e o resumo deles (pedido_resumo), e o pedido que expira (pedido_expirando).
    • Cartão do imóvel e do pedido (cartoes-email.ts) no lugar do texto genérico.
    • Sem repetição: uma linha da fila por (pessoa, evento, imóvel ou pedido) — chaveProativo.
    • Teto por pessoa: 1 por dia (dia de Brasília) e 3 nos últimos 7 dias; o que não cabe espera o próximo envio,
      agrupado (até 3 cartões e "ver os N"). Silêncio das 22h às 7h. Decisão e transacional ficam FORA do teto.
    • Descadastro de um clique (link assinado, sem login): desliga só a categoria "sugestoes".
  Roda: node --test src/lib/notifications/proativos.test.ts
*/
import crypto from "node:crypto";
import { emSilencio } from "./silencio.ts";

/** Os eventos da categoria "Sugestões e novidades". */
export const EVENTOS_PROATIVOS = ["pedido_imovel_novo", "saved_search_match", "pedido_compativel", "pedido_resumo", "pedido_expirando"] as const;
export type EventoProativo = (typeof EVENTOS_PROATIVOS)[number];
/** O que entra na fila (o resumo é o pedido_compativel com mais de um pedido). */
export type EventoNaFila = Exclude<EventoProativo, "pedido_resumo">;

export const TETO_PROATIVOS = { porDia: 1, porSemana: 3 } as const;
/** Cartões por e-mail; o resto vira "ver os N". */
export const MAX_CARTOES = 3;

/** Chave da fila: uma linha por (pessoa, evento, imóvel ou pedido). `ciclo` separa o mesmo pedido em outra validade. */
export function chaveProativo(usuarioId: string, evento: EventoNaFila, refId: string, ciclo?: string | null): string {
  return ["proativo", evento, usuarioId, refId, ciclo].filter(Boolean).join(":");
}

const BRT = -3 * 3_600_000;
/** O dia (yyyy-mm-dd) em Brasília. */
export function diaBrasilia(d: Date): string {
  return new Date(d.getTime() + BRT).toISOString().slice(0, 10);
}
const menosDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

/**
 * Cabe mais um proativo para a pessoa? `envios`: quando saiu cada e-mail proativo dela (um por e-mail, não por cartão).
 * No máximo 1 no dia de Brasília e 3 nos últimos 7 dias (o de hoje e os 6 anteriores).
 */
export function cabeNoTeto(envios: readonly (string | Date)[], agora: Date): boolean {
  const hoje = diaBrasilia(agora);
  const inicioSemana = menosDias(hoje, 6);
  const dias = envios.map((e) => diaBrasilia(new Date(e)));
  if (dias.filter((d) => d === hoje).length >= TETO_PROATIVOS.porDia) return false;
  return dias.filter((d) => d >= inicioSemana && d <= hoje).length < TETO_PROATIVOS.porSemana;
}

export type PodeEnviar = "ok" | "silencio" | "teto";
/** Agora pode sair um proativo para a pessoa? (silêncio primeiro: nada sai entre 22h e 7h). */
export function podeEnviarProativo(envios: readonly (string | Date)[], agora: Date): PodeEnviar {
  if (emSilencio(agora)) return "silencio";
  return cabeNoTeto(envios, agora) ? "ok" : "teto";
}

export interface Pendente {
  evento: EventoNaFila;
  criado_em: string;
}

/** Qual evento sai neste envio: o do pendente mais antigo; vão junto todos os pendentes desse evento (mais antigo antes). */
export function escolherLote<T extends Pendente>(pendentes: readonly T[]): { evento: EventoNaFila; itens: T[] } | null {
  if (!pendentes.length) return null;
  const ordem = [...pendentes].sort((a, b) => Date.parse(a.criado_em) - Date.parse(b.criado_em));
  const evento = ordem[0].evento;
  return { evento, itens: ordem.filter((p) => p.evento === evento) };
}

/** O evento do e-mail: mais de um pedido compatível vira o resumo. */
export function eventoDoEnvio(evento: EventoNaFila, n: number): EventoProativo {
  return evento === "pedido_compativel" && n > 1 ? "pedido_resumo" : evento;
}

/** Assunto (sem a marca), só com fato verdadeiro: a contagem real e, no pedido que expira, os dias que faltam. */
export function assuntoProativo(evento: EventoProativo, n: number, diasParaExpirar?: number | null): string {
  switch (evento) {
    case "pedido_imovel_novo":
      return n > 1 ? `${n} imóveis combinam com o seu pedido` : "Surgiu um imóvel que combina com o seu pedido";
    case "saved_search_match":
      return n > 1 ? `${n} imóveis combinam com a sua busca` : "Novo imóvel para a sua busca";
    case "pedido_compativel":
      return "Um pedido de moradia combina com o seu imóvel";
    case "pedido_resumo":
      return `${n} pedidos de moradia combinam com os seus imóveis`;
    case "pedido_expirando":
      if (diasParaExpirar != null && diasParaExpirar >= 0) {
        return diasParaExpirar === 0 ? "Seu pedido de moradia expira hoje" : `Seu pedido de moradia expira em ${diasParaExpirar} ${diasParaExpirar === 1 ? "dia" : "dias"}`;
      }
      return "Seu pedido de moradia está perto de expirar";
  }
}

/** Abertura do e-mail (o nome vem tratado de fora). */
export function aberturaProativo(evento: EventoProativo, n: number, nome?: string): string {
  const ola = `Olá${nome ? " " + nome : ""}`;
  switch (evento) {
    case "pedido_imovel_novo":
      return n > 1
        ? `${ola}, ${n} imóveis publicados combinam com o seu pedido de moradia. Veja os destaques abaixo.`
        : `${ola}, um imóvel publicado agora combina com o seu pedido de moradia.`;
    case "saved_search_match":
      return n > 1 ? `${ola}, ${n} imóveis novos combinam com a sua busca salva.` : `${ola}, um imóvel novo combina com a sua busca salva.`;
    case "pedido_compativel":
      return `${ola}, um pedido de moradia combina com um dos seus imóveis. Responda pela plataforma: a conversa fica registrada.`;
    case "pedido_resumo":
      return `${ola}, ${n} pedidos de moradia combinam com os seus imóveis. Veja os destaques abaixo e responda pela plataforma.`;
    case "pedido_expirando":
      return `${ola}, o seu pedido de moradia está perto de expirar. Se ainda está procurando, renove com um clique e ele continua visível para os proprietários.`;
  }
}

/** Rótulo do botão de cada cartão e do botão final. */
export const BOTAO_CARTAO = { imovel: "Ver o imóvel", pedidoDono: "Responder ao pedido", pedidoMorador: "Renovar o pedido" } as const;

export function botaoFinal(evento: EventoProativo, n: number): { rotulo: string; caminho: string } | null {
  if (n <= MAX_CARTOES) return null;
  switch (evento) {
    case "pedido_imovel_novo":
      return { rotulo: `Ver os ${n} imóveis`, caminho: "/dashboard/pedidos" };
    case "saved_search_match":
      return { rotulo: `Ver os ${n} imóveis`, caminho: "/dashboard/buscas" };
    case "pedido_compativel":
    case "pedido_resumo":
      return { rotulo: `Ver os ${n} pedidos`, caminho: "/dashboard/pedidos-cidade" };
    case "pedido_expirando":
      return { rotulo: `Ver os ${n} pedidos`, caminho: "/dashboard/pedidos" };
  }
}

/** Para onde o push e o fallback do e-mail levam. */
export const CAMINHO_PROATIVO: Record<EventoProativo, string> = {
  pedido_imovel_novo: "/dashboard/pedidos",
  saved_search_match: "/dashboard/buscas",
  pedido_compativel: "/dashboard/pedidos-cidade",
  pedido_resumo: "/dashboard/pedidos-cidade",
  pedido_expirando: "/dashboard/pedidos",
};

// ── Descadastro de um clique (sem login) ───────────────────────────────────────────────────────────────────────────

export const CATEGORIA_PROATIVOS = "sugestoes" as const;
export const TEXTO_DESCADASTRO = "Não quero mais este tipo de e-mail";

/** Assinatura do link de descadastro (uma por pessoa e categoria; não expira, só desliga). */
export function assinarDescadastro(usuarioId: string, segredo: string): string {
  return crypto.createHmac("sha256", segredo).update(`descadastro:${CATEGORIA_PROATIVOS}:${usuarioId}`).digest("base64url");
}

export function conferirDescadastro(usuarioId: string, assinatura: string, segredo: string): boolean {
  if (!/^[0-9a-f-]{36}$/i.test(usuarioId) || !assinatura || !segredo) return false;
  const esperado = Buffer.from(assinarDescadastro(usuarioId, segredo));
  const recebido = Buffer.from(assinatura);
  return esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido);
}

/** O link do descadastro (página com confirmação) e o alvo do one-click (POST do provedor, RFC 8058). */
export function urlsDescadastro(siteUrl: string, usuarioId: string, segredo: string): { pagina: string; umClique: string } {
  const q = `u=${encodeURIComponent(usuarioId)}&t=${encodeURIComponent(assinarDescadastro(usuarioId, segredo))}`;
  return { pagina: `${siteUrl}/avisos/desligar?${q}`, umClique: `${siteUrl}/api/avisos/desligar?${q}` };
}

/** A categoria entra nas desligadas da pessoa (sem repetir, sem mexer nas outras). */
export function comSugestoesDesligadas(desligadas: readonly string[] | null | undefined): string[] {
  const atual = [...(desligadas ?? [])];
  return atual.includes(CATEGORIA_PROATIVOS) ? atual : [...atual, CATEGORIA_PROATIVOS];
}
