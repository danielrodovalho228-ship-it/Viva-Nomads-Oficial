/*
  Corpos de e-mail no modelo único (layoutEmail) — PUROS, com o endereço do site como parâmetro, para o envio de
  produção (templates.ts põe o SITE_URL) e o teste de auditoria gerarem exatamente o mesmo HTML.
*/
import { botaoEmail, layoutEmail, rodapeTexto } from "./modelo-email.ts";

export type Hero = { src: string; alt: string };

/** Pré-cabeçalho (a linha cinza depois do assunto na caixa de entrada): o começo do texto, sem tags. */
export function preheaderDe(intro: string): string {
  const t = intro.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return t.length > 110 ? `${t.slice(0, 109).trimEnd()}…` : t;
}

/** Imagem de assunto hospedada em public/media/email/. */
export function imagemEmail(siteUrl: string, arquivo: string, alt: string): Hero {
  return { src: `${siteUrl}/media/email/${arquivo}.jpg`, alt };
}

const h1 = (t: string) => `<h1 class="vn-t" style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#123b26;">${t}</h1>`;
const nota = (t?: string) => (t ? `<p class="vn-mut" style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">${t}</p>` : "");

/** Título, texto e um botão. */
export function corpoBotao(siteUrl: string, o: { title: string; intro: string; button: string; url: string; outro?: string; image?: Hero }): string {
  return layoutEmail(
    `${h1(o.title)}<p class="vn-p" style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#374151;">${o.intro}</p>${botaoEmail(o.url, o.button)}${nota(o.outro)}`,
    { siteUrl, image: o.image, preheader: preheaderDe(o.intro) },
  );
}

/** Código (6 dígitos) em destaque, sem botão. O código nunca vai no pré-cabeçalho. */
export function corpoCodigo(siteUrl: string, o: { title: string; intro: string; code: string; outro?: string; image?: Hero }): string {
  return layoutEmail(
    `${h1(o.title)}<p class="vn-p" style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#374151;">${o.intro}</p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr><td align="center" class="vn-box" style="padding:18px;background:#f2fbe9;border:1px dashed #8FD63A;border-radius:12px;">
       <span class="vn-t" style="font-size:34px;font-weight:800;letter-spacing:8px;color:#123b26;">${o.code}</span>
     </td></tr></table>${nota(o.outro)}`,
    { siteUrl, image: o.image, preheader: preheaderDe(o.intro) },
  );
}

/** Notificação: título + texto + detalhes (já com estilo inline) + UM botão. */
export function corpoNotificacao(
  siteUrl: string,
  o: { title: string; intro: string; detailsHtml?: string; cta?: { label: string; url: string }; outro?: string; image?: Hero },
): string {
  const gap = o.detailsHtml || o.cta ? "18px" : "0";
  return layoutEmail(
    `${h1(o.title)}<p class="vn-p" style="margin:0 0 ${gap};font-size:15px;line-height:1.6;color:#374151;">${o.intro}</p>
     ${o.detailsHtml ?? ""}
     ${o.cta ? `<div style="margin-top:20px;">${botaoEmail(o.cta.url, o.cta.label)}</div>` : ""}${nota(o.outro)}`,
    { siteUrl, image: o.image, preheader: preheaderDe(o.intro) },
  );
}

/** Versão TEXTO PURO (multipart) — mesma informação, sem HTML. */
export function textoNotificacao(siteUrl: string, o: { title: string; intro: string; detailsText?: string; cta?: { label: string; url: string } }): string {
  return [o.title, "", o.intro, o.detailsText ? `\n${o.detailsText}` : "", o.cta ? `\n${o.cta.label}: ${o.cta.url}` : "", `\n${rodapeTexto(siteUrl)}`]
    .filter((l) => l !== "")
    .join("\n");
}
