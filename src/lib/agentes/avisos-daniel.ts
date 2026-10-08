/*
  Avisos do Moacir ao Daniel por e-mail (Central humana, PR 4). Módulo puro: o envio, o
  limite diário, o resumo das 19h e o link assinado. O acesso ao banco entra por `Deps`
  (ver avisos-daniel-servidor.ts), por isso tudo aqui é testável sem rede.
  Roda: node --test src/lib/agentes/avisos-daniel.test.ts
*/
import crypto from "node:crypto";
import { escaparHtml } from "../escapar-html.ts";
import { textoEmail, textoPlano } from "../notifications/texto-seguro.ts";

export const REMETENTE_MOACIR = "Moacir – Viva Nomads <moacir@vivanomads.com.br>";
export const RESPONDER_PARA = "moacir@vivanomads.com.br";
/** E-mails por dia (fora os P0). O resto vai no resumo das 19h de Brasília. */
export const LIMITE_EMAILS_DIA = 6;
export const HORA_RESUMO = 19;
export const MAX_TENTATIVAS = 3;
/** O link assinado só abre a tela de aprovação (login admin); vale 72 h. */
export const VALIDADE_LINK_H = 72;

export interface Aviso {
  id: string;
  origem_ronda: string | null;
  assunto: string;
  corpo: string;
  prioridade: "P0" | "P1" | "P2" | "P3";
  link: string | null;
}

export interface Mensagem {
  from: string;
  replyTo: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Deps {
  /** Valor de AVISO_DANIEL_EMAIL (nunca escrito no código). */
  destino(): string | undefined;
  /** Avisos sem envio e com menos de MAX_TENTATIVAS falhas, do mais antigo ao mais novo. */
  pendentes(): Promise<Aviso[]>;
  emailsHoje(): Promise<number>;
  resumoHoje(): Promise<boolean>;
  /** Reserva o aviso (enviado_em=agora onde ainda é nulo). false = outra execução pegou. */
  reservar(id: string, via: "email" | "resumo"): Promise<boolean>;
  /** Desfaz a reserva e anota o erro. `contar` soma uma tentativa. */
  falhou(id: string, erro: string, contar: boolean): Promise<void>;
  enviar(m: Mensagem): Promise<{ ok: boolean; erro?: string }>;
  agora(): Date;
  siteUrl: string;
  segredo: string;
}

export interface Resultado {
  enviados: number;
  resumidos: number;
  adiados: number;
  erro?: string;
}

export function horaBrasilia(d: Date): number {
  return (d.getUTCHours() + 24 - 3) % 24;
}

function chave(segredo: string): Buffer {
  return crypto.createHash("sha256").update(`aviso-daniel:${segredo}`).digest();
}

function assinar(ronda: string, expira: number, segredo: string): string {
  return crypto.createHmac("sha256", chave(segredo)).update(`${ronda}.${expira}`).digest("hex").slice(0, 32);
}

/** Link da tela de aprovação (exige login admin). NÃO aprova nada sozinho. */
export function linkDecisao(ronda: string, agora: Date, siteUrl: string, segredo: string): string {
  const expira = Math.floor(agora.getTime() / 1000) + VALIDADE_LINK_H * 3600;
  return `${siteUrl}/admin/agentes/aprovar?r=${encodeURIComponent(ronda)}&e=${expira}&s=${assinar(ronda, expira, segredo)}`;
}

/** Confere assinatura e prazo. O "uma vez só" fica com a tela de aprovação, que consome o link. */
export function linkValido(ronda: string, expira: number, assinatura: string, agora: Date, segredo: string): boolean {
  if (!Number.isFinite(expira) || expira * 1000 < agora.getTime()) return false;
  const esperado = Buffer.from(assinar(ronda, expira, segredo));
  const recebido = Buffer.from(String(assinatura));
  return esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido);
}

function mensagemAviso(a: Aviso, para: string, d: Deps): Mensagem {
  const corpo = textoPlano(a.corpo, 600);
  const alvo = a.link ?? (a.origem_ronda ? linkDecisao(a.origem_ronda, d.agora(), d.siteUrl, d.segredo) : null);
  const acao = a.link
    ? "Abra o link abaixo."
    : a.origem_ronda
      ? "Abra a tela de decisão (exige login de administrador) e escolha Aprovar ou Recusar."
      : "Nada a decidir agora.";
  const text = [`O que aconteceu: ${textoPlano(a.assunto, 200)}`, corpo, `O que precisa de você: ${acao}`, alvo ?? ""]
    .filter(Boolean)
    .join("\n\n");
  const html =
    `<p><strong>O que aconteceu:</strong> ${textoEmail(a.assunto, 200)}</p>` +
    (corpo ? `<p>${textoEmail(a.corpo, 600)}</p>` : "") +
    `<p><strong>O que precisa de você:</strong> ${escaparHtml(acao)}</p>` +
    (alvo ? `<p><a href="${escaparHtml(alvo)}">${escaparHtml(a.link ? "Abrir" : "Abrir a tela de decisão")}</a></p>` : "");
  return { from: REMETENTE_MOACIR, replyTo: RESPONDER_PARA, to: para, subject: `[Viva Nomads] ${a.prioridade} — ${textoPlano(a.assunto, 120)}`, html, text };
}

function mensagemResumo(lista: Aviso[], para: string, d: Deps): Mensagem {
  const linhas = lista.map((a) => `${a.prioridade} — ${textoPlano(a.assunto, 160)}`);
  const text = [`Avisos que passaram do limite de ${LIMITE_EMAILS_DIA} e-mails de hoje:`, ...linhas.map((l) => `• ${l}`), `Veja a Central: ${d.siteUrl}/admin/agentes`].join("\n");
  const html =
    `<p>Avisos que passaram do limite de ${LIMITE_EMAILS_DIA} e-mails de hoje:</p><ul>` +
    lista.map((a) => `<li>${escaparHtml(a.prioridade)} — ${textoEmail(a.assunto, 160)}</li>`).join("") +
    `</ul><p><a href="${escaparHtml(`${d.siteUrl}/admin/agentes`)}">Abrir a Central</a></p>`;
  return { from: REMETENTE_MOACIR, replyTo: RESPONDER_PARA, to: para, subject: `[Viva Nomads] Resumo do dia — ${lista.length} aviso(s)`, html, text };
}

/** Uma passada do cron: manda o que cabe no limite e, às 19h+, o resumo do que sobrou. */
export async function processarAvisos(d: Deps): Promise<Resultado> {
  const r: Resultado = { enviados: 0, resumidos: 0, adiados: 0 };
  const pendentes = await d.pendentes();
  if (!pendentes.length) return r;

  const para = d.destino()?.trim();
  if (!para) {
    r.erro = "AVISO_DANIEL_EMAIL não configurada: nada foi enviado.";
    for (const a of pendentes) await d.falhou(a.id, r.erro, false);
    return r;
  }

  let hoje = await d.emailsHoje();
  const excedentes: Aviso[] = [];
  for (const a of pendentes) {
    if (a.prioridade !== "P0" && hoje >= LIMITE_EMAILS_DIA) {
      excedentes.push(a);
      continue;
    }
    if (!(await d.reservar(a.id, "email"))) continue;
    const e = await d.enviar(mensagemAviso(a, para, d));
    if (!e.ok) {
      await d.falhou(a.id, e.erro ?? "Falha no envio.", true);
      continue;
    }
    r.enviados++;
    if (a.prioridade !== "P0") hoje++;
  }

  if (excedentes.length) {
    if (horaBrasilia(d.agora()) >= HORA_RESUMO && !(await d.resumoHoje())) {
      const reservados: Aviso[] = [];
      for (const a of excedentes) if (await d.reservar(a.id, "resumo")) reservados.push(a);
      if (reservados.length) {
        const e = await d.enviar(mensagemResumo(reservados, para, d));
        if (e.ok) r.resumidos = reservados.length;
        else for (const a of reservados) await d.falhou(a.id, e.erro ?? "Falha no envio do resumo.", true);
      }
    } else {
      r.adiados = excedentes.length;
    }
  }
  return r;
}
