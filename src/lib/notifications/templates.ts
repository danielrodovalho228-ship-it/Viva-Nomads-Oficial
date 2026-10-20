/*
  Templates de e-mail brandados (Viva Nomads). HTML e-mail-safe (tabelas +
  estilos inline). O logo é a imagem hospedada em /email-mark.png + o texto
  "VivaNomads" colorido (aparece mesmo com imagens bloqueadas).

  Embrulham os corpos puros de corpo-email.ts com o SITE_URL. A lista completa de e-mails (com dados fictícios)
  mora em catalogo-emails.ts (rota /api/test-email?all=1 e prévia /dev/emails).
*/
import { SITE_URL } from "@/lib/site";
import { corpoBotao, corpoCodigo, corpoNotificacao, imagemEmail, textoNotificacao, type Hero } from "./corpo-email";

export { preheaderDe } from "./corpo-email";

/** URL da imagem de assunto do e-mail (hospedada em public/media/email/). */
export function emailImage(key: string, alt: string): Hero {
  return imagemEmail(SITE_URL, key, alt);
}

/** E-mail com título, texto e botão (CTA). */
export function brandedEmail(o: { title: string; intro: string; button: string; url: string; outro?: string; image?: Hero }): string {
  return corpoBotao(SITE_URL, o);
}

/** E-mail com código (OTP) em destaque, sem botão. */
export function brandedCodeEmail(o: { title: string; intro: string; code: string; outro?: string; image?: Hero }): string {
  return corpoCodigo(SITE_URL, o);
}

/**
 * E-mail de NOTIFICAÇÃO brandado (layout-mãe): título + texto + bloco opcional
 * de detalhes (já vem com CSS inline) + UM botão. Usado pelo notify() de
 * produção para que todo e-mail transacional saia com a marca — e nunca exponha
 * contato da outra parte (isso é responsabilidade de quem monta o detailsHtml).
 */
export function brandedNotification(o: {
  title: string;
  intro: string;
  detailsHtml?: string;
  cta?: { label: string; url: string };
  outro?: string;
  image?: Hero;
}): string {
  return corpoNotificacao(SITE_URL, o);
}

/** Versão TEXTO PURO (multipart) da notificação — mesma informação, sem HTML. */
export function notificationText(o: { title: string; intro: string; detailsText?: string; cta?: { label: string; url: string } }): string {
  return textoNotificacao(SITE_URL, o);
}
