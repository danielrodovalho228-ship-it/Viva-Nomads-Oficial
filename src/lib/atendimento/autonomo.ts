/*
  ATENDIMENTO AUTÔNOMO — regras PURAS (testáveis, sem banco).

  Decisões do Daniel (07/10/2026):
  • Quem pede para falar com uma PESSOA nunca recebe resposta da IA: fica com o
    acolhimento (número e prazo), a Viva deixa a resposta SUGERIDA para o Daniel
    aprovar e a prioridade sobe um nível.
  • A promessa pública continua "uma pessoa responde em até 24 h".
  • Erro técnico relatado no chamado vira ordem para o Renato (corrige) e para o
    Otávio (acompanha), sem dado pessoal.
*/
import { pedeHumano } from "./viva-regras.ts";
import { guardContactInfo } from "../messages/contact-guard.ts";
import type { ResumoChamado } from "./resumo.ts";
import { textoEmail } from "../notifications/texto-seguro.ts";

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Rodapé de toda resposta automática da Viva dentro do chamado (site e e-mail). */
export const RODAPE_AUTOMATICO = 'Resposta automática da Viva. Quer falar com uma pessoa? Responda "pessoa".';

/** Pediu pessoa: as frases do chat ("quero falar com um atendente"…) ou só "pessoa"/"humano". */
export function pedePessoaNoTexto(texto: string): boolean {
  return pedeHumano(texto);
}

/**
 * Pediu pessoa: a prioridade sobe um nível, ATÉ P2 (p4 → p3 → p2). P1 fica
 * reservado para urgência de verdade (golpe, segurança, emergência), que
 * dispara o aviso urgente — uma dúvida de Caução não vira emergência.
 */
export function prioridadeAcima<P extends "p1" | "p2" | "p3" | "p4">(p: P): "p1" | "p2" | "p3" | "p4" {
  return ({ p4: "p3", p3: "p2", p2: "p2", p1: "p1" } as const)[p];
}

// ── Erro técnico → ordem para o Renato e o Otávio ──────────────────────────
const RE_ERRO_TECNICO =
  /\b(pagina|site|tela|botao|link|formulario|app|aplicativo|cadastro|login|entrar)\b.{0,60}\b(nao (abre|carrega|funciona|aparece|envia|salva|deixa)|deu erro|da erro|com erro|travou|trava|quebrad[oa]|em branco|fora do ar)|\berro (ao|no|na|de) (cadastr|entrar|logar|salvar|enviar|abrir|carregar|publicar|anunciar|pagar)\w*|\b(erro|error) (404|500|502|503)\b|\b(404|500) (not found|internal)|\bpagina nao encontrada\b/;

export function relataErroTecnico(texto: string): boolean {
  return RE_ERRO_TECNICO.test(norm(texto));
}

/** URL ou caminho do site citado pela pessoa (para o Renato reproduzir). */
export function urlDoErro(texto: string): string | null {
  const url = texto.match(/https?:\/\/[^\s<>"')]+/i)?.[0];
  if (url) return url.replace(/[.,;:!?]+$/, "").slice(0, 200);
  const caminho = texto.match(/(?:^|\s)(\/[a-z0-9][a-z0-9\-_/?=&.%]*)/i)?.[1];
  return caminho ? caminho.replace(/[.,;:!?]+$/, "").slice(0, 200) : null;
}

/** Tira contato e documentos do texto (vai para a ordem dos agentes). */
export function semDadosPessoais(texto: string): string {
  return guardContactInfo(texto)
    .text.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[documento]")
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[documento]")
    .replace(/\s+/g, " ")
    .trim();
}

export function textoOrdemErro(p: { numero: string; url: string | null; mensagem: string; para: "renato" | "otavio" }): string {
  const trecho = semDadosPessoais(p.mensagem).slice(0, 400);
  const onde = p.url ? ` em ${p.url}` : "";
  return p.para === "renato"
    ? `Erro técnico relatado no chamado ${p.numero}${onde}. Reproduza, corrija e abra o PR (sem tocar em dado de cliente). Mensagem: "${trecho}"`
    : `Acompanhe: o chamado ${p.numero} relatou erro técnico${onde} e foi encaminhado ao Renato. Confira em produção depois do PR. Mensagem: "${trecho}"`;
}

// ── E-mail ao Daniel com resumo, ações e resposta sugerida ─────────────────
export function htmlAvisoEquipe(p: {
  numero: string;
  assunto: string;
  motivo: string;
  linkAdmin: string;
  resumo?: ResumoChamado | null;
  sugestao?: string | null;
  respondidaPelaViva?: boolean;
}): string {
  const partes = [
    `<p style="margin:12px 0 0;color:#334155;"><strong>${textoEmail(p.numero, 20)}</strong> · ${textoEmail(p.assunto, 140)}<br/>${textoEmail(p.motivo, 200)}</p>`,
  ];
  if (p.resumo) {
    partes.push(`<p style="margin:14px 0 4px;color:#0f1722;font-weight:600;">Resumo</p><p style="margin:0;color:#334155;">${textoEmail(p.resumo.resumo, 600)}</p>`);
    if (p.resumo.acoes.length) {
      partes.push(
        `<p style="margin:12px 0 4px;color:#0f1722;font-weight:600;">O que fazer</p><ul style="margin:0;padding-left:18px;color:#334155;">${p.resumo.acoes
          .slice(0, 5)
          .map((a) => `<li>${textoEmail(a.texto, 200)}</li>`)
          .join("")}</ul>`
      );
    }
  }
  if (p.sugestao) {
    partes.push(
      `<p style="margin:14px 0 4px;color:#0f1722;font-weight:600;">${p.respondidaPelaViva ? "A Viva já respondeu (informação oficial)" : "Resposta sugerida pela Viva"}</p><blockquote style="margin:0;padding:10px 14px;border-left:3px solid #1c6b3a;color:#334155;">${textoEmail(p.sugestao, 1500)}</blockquote>`
    );
  }
  const botao = p.sugestao && !p.respondidaPelaViva ? "Aprovar e enviar no admin" : "Abrir no admin";
  partes.push(
    `<p style="margin:16px 0 0;"><a href="${p.linkAdmin}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#1c6b3a;color:#fff;text-decoration:none;font-weight:600;">${botao}</a></p>`
  );
  return partes.join("");
}
