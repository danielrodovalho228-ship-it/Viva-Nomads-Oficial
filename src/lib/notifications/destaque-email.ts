/*
  E438 (Relay 48 + Relay 50, aprovado pelo Daniel) — a imagem REAL do assunto do e-mail. PURO.
    • E-mail ligado a UM imóvel: a foto de capa real do anúncio no lugar do banner genérico, clicável para a página do anúncio.
    • E-mail ligado a UM parceiro: a imagem real do parceiro (a foto do perfil público), clicável para a página dele.
    • Imóvel + parceiro: o imóvel em destaque no topo; o parceiro num bloco junto aos dados dele.
    • Sem foto/imagem (ou página que não está no ar): o banner genérico do tema, como antes.
  Versão texto: nunca leva a URL da imagem (sem imagem quebrada, sem URL crua — mesma linha do E434); só o link da
  página, com rótulo ("Ver o anúncio: …"), como os demais links do texto puro.
*/
import { escaparHtml } from "../escapar-html.ts";
import { fotoDoCartao, urlDoImovel } from "./cartoes-email.ts";
import type { ImagemEmail } from "./modelo-email.ts";

export interface DestaqueImovel {
  id: string;
  titulo: string;
  /** URL pública da capa (property_photos de menor ordem). */
  fotoCapa: string | null;
  /** Só anúncio no ar tem página pública: fora do ar, nem foto nem link. */
  publicado: boolean;
}

export interface DestaqueParceiro {
  slug: string | null;
  nome: string;
  /** Caminho da foto do perfil no bucket público "parceiros" (`<uuid>/avatar-<hex>.webp`). */
  avatarPath: string | null;
  /** Só parceiro publicado tem página pública. */
  publicado: boolean;
}

export interface DestaqueEmail {
  imovel?: DestaqueImovel | null;
  parceiro?: DestaqueParceiro | null;
}

/** Caminho aceito da imagem do parceiro (mesmo formato que o painel grava). */
export const CAMINHO_PARCEIRO_EMAIL_RE = /^[0-9a-f-]{36}\/(?:avatar|banner)-[0-9a-f]{16}\.webp$/i;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const limpo = (s: string | null | undefined, max = 120) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function urlDoParceiro(siteUrl: string, slug: string): string {
  return `${siteUrl}/parceiros/${encodeURIComponent(slug)}`;
}

/** Imagem do parceiro em JPEG pela rota própria do e-mail (nunca uma URL qualquer). */
export function imagemDoParceiroEmail(siteUrl: string, avatarPath: string | null | undefined): string | null {
  const p = String(avatarPath ?? "");
  return CAMINHO_PARCEIRO_EMAIL_RE.test(p) ? `${siteUrl}/api/email/foto?pc=${p}` : null;
}

function parceiroComPagina(p: DestaqueParceiro | null | undefined): p is DestaqueParceiro & { slug: string } {
  return !!p && p.publicado && !!p.slug && SLUG_RE.test(p.slug);
}

/** Topo do e-mail: a capa do anúncio; sem ela, a imagem do parceiro (se o e-mail não tem imóvel); senão, null (banner genérico). */
export function heroDoDestaque(siteUrl: string, d: DestaqueEmail | null | undefined): ImagemEmail | null {
  const im = d?.imovel;
  if (im?.publicado) {
    const src = fotoDoCartao(siteUrl, im.fotoCapa);
    if (src) return { src, alt: `Foto do anúncio ${escaparHtml(limpo(im.titulo) || "do imóvel")}`, href: urlDoImovel(siteUrl, im.id) };
  }
  // Com imóvel no e-mail, o parceiro nunca toma o topo (vai no bloco dele).
  if (im) return null;
  const pc = d?.parceiro;
  if (parceiroComPagina(pc)) {
    const src = imagemDoParceiroEmail(siteUrl, pc.avatarPath);
    if (src) return { src, alt: `Foto de ${escaparHtml(limpo(pc.nome, 80) || "parceiro")}`, href: urlDoParceiro(siteUrl, pc.slug) };
  }
  return null;
}

/** Bloco do parceiro junto aos dados (só quando o e-mail também tem imóvel): foto pequena + nome, os dois clicáveis. */
export function blocoParceiroHtml(siteUrl: string, d: DestaqueEmail | null | undefined): string {
  const pc = d?.parceiro;
  if (!d?.imovel || !parceiroComPagina(pc)) return "";
  const src = imagemDoParceiroEmail(siteUrl, pc.avatarPath);
  if (!src) return "";
  const url = urlDoParceiro(siteUrl, pc.slug);
  const nome = escaparHtml(limpo(pc.nome, 80) || "Parceiro");
  return `<table role="presentation" cellpadding="0" cellspacing="0" class="vn-box" data-parceiro-email style="width:100%;margin:0 0 20px;padding:10px 14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;"><tr>
    <td style="width:56px;vertical-align:middle;"><a href="${url}"><img src="${src}" alt="Foto de ${nome}" width="48" height="48" style="display:block;width:48px;height:48px;border-radius:24px;border:0;object-fit:cover;" /></a></td>
    <td style="vertical-align:middle;padding-left:10px;"><div class="vn-mut" style="font-size:12px;color:#6b7280;">Parceiro</div><a href="${url}" class="vn-t" style="font-size:15px;font-weight:700;color:#123b26;text-decoration:none;">${nome}</a></td>
  </tr></table>`;
}

/** Linhas do texto puro: o link da página, com rótulo. Nunca a URL da imagem. */
export function linhasTextoDoDestaque(siteUrl: string, d: DestaqueEmail | null | undefined): string {
  const linhas: string[] = [];
  const im = d?.imovel;
  if (im?.publicado && heroDoDestaque(siteUrl, { imovel: im })) linhas.push(`Ver o anúncio: ${urlDoImovel(siteUrl, im.id)}`);
  const pc = d?.parceiro;
  if (parceiroComPagina(pc) && imagemDoParceiroEmail(siteUrl, pc.avatarPath)) linhas.push(`Ver a página do parceiro: ${urlDoParceiro(siteUrl, pc.slug)}`);
  return linhas.join("\n");
}
