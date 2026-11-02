/*
  E441, parte B/e-mails (Relay 51, pacote aprovado pelo Daniel em 02/11) — o morador no e-mail ao dono sobre um
  pedido/orçamento dele. PURO.
    • Foto de perfil do morador, clicável para o detalhe da solicitação, junto do nome. Datas, valores e número do
      orçamento seguem no quadro de dados do próprio e-mail.
    • Mesma regra do calendário com foto (e de podeVerAvatar): a foto do morador só com relação ACEITA (candidatura
      aceita ou contrato). Antes disso, ou sem foto: o avatar com as iniciais (cor determinística pelo nome).
    • A foto sai pela rota própria do e-mail (/api/email/avatar), assinada (dono + morador) e que confere a relação
      de novo a cada abertura — nunca a URL do bucket privado.
  Versão texto: sem imagem e sem URL de imagem (E434); só o nome e o link da solicitação, com rótulo.
*/
import { corAvatar, rostoDoAvatar } from "../avatar.ts";
import { escaparHtml } from "../escapar-html.ts";

export interface MoradorDoEmail {
  /** Nome como o dono pode ver (primeiro nome antes do aceite; completo depois). */
  nome: string;
  /** URL da foto pela rota do e-mail, ou null (iniciais). */
  fotoUrl: string | null;
  /** Detalhe da solicitação (absoluta). */
  url: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const limpo = (s: string | null | undefined, max = 80) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** URL assinada da foto do morador para o e-mail do dono (a assinatura vem de assinarAvatarEmail, no servidor). */
export function urlAvatarEmail(siteUrl: string, donoId: string, moradorId: string, assinatura: string): string | null {
  if (!UUID.test(donoId) || !UUID.test(moradorId) || !/^[0-9a-f]{32}$/.test(assinatura)) return null;
  return `${siteUrl}/api/email/avatar?d=${donoId}&m=${moradorId}&s=${assinatura}`;
}

/** O que entra no lugar da foto: a foto só com relação aceita e foto cadastrada; senão, as iniciais. */
export function fotoParaOEmail(p: { relacaoAceita: boolean; temFoto: boolean; url: string | null }): string | null {
  return p.relacaoAceita && p.temFoto && p.url ? p.url : null;
}

function avatarHtml(m: MoradorDoEmail, nome: string): string {
  const estilo = "display:block;width:48px;height:48px;border-radius:24px;border:0;";
  if (m.fotoUrl) return `<img src="${m.fotoUrl}" alt="Foto de ${nome}" width="48" height="48" style="${estilo}object-fit:cover;" />`;
  const rosto = rostoDoAvatar(m.nome);
  const texto = rosto.tipo === "iniciais" ? escaparHtml(rosto.texto) : "&#9679;";
  // Iniciais em HTML puro (sem imagem): nada para quebrar no leitor de e-mail.
  return `<span data-iniciais style="${estilo}display:inline-block;line-height:48px;text-align:center;font-size:18px;font-weight:700;color:#ffffff;background:${corAvatar(m.nome)};">${texto}</span>`;
}

/** Bloco do morador (HTML) para o topo dos dados do e-mail. */
export function blocoMoradorHtml(m: MoradorDoEmail): string {
  const nome = escaparHtml(limpo(m.nome) || "Morador");
  return `<table role="presentation" cellpadding="0" cellspacing="0" class="vn-box" data-morador-email style="width:100%;margin:0 0 16px;padding:10px 14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;"><tr>
    <td style="width:56px;vertical-align:middle;"><a href="${m.url}" style="text-decoration:none;">${avatarHtml(m, nome)}</a></td>
    <td style="vertical-align:middle;padding-left:10px;"><div class="vn-mut" style="font-size:12px;color:#6b7280;">Morador</div><a href="${m.url}" class="vn-t" style="font-size:15px;font-weight:700;color:#123b26;text-decoration:none;">${nome}</a></td>
  </tr></table>`;
}

/** Linhas do texto puro: nome e o link da solicitação. Nunca a URL da foto. */
export function linhasMoradorTexto(m: MoradorDoEmail, rotuloLink = "Ver a solicitação"): string {
  return [`Morador: ${limpo(m.nome) || "Morador"}`, `${rotuloLink}: ${m.url}`].join("\n");
}
