/*
  Texto do USUÁRIO dentro de e-mail oficial (título de anúncio, nome, prévia de
  mensagem, motivo). Módulo puro, testável.

  Duas camadas:
    1. escapa HTML — `<a href=…>` vira texto, não link clicável;
    2. neutraliza endereços (http://, www., dominio.com/…) — o cliente de e-mail
       não transforma em link e ninguém recebe "link da Viva Nomads" de golpe.
  O texto na plataforma continua igual; isto vale só para o e-mail.
*/
import { escaparHtml } from "../escapar-html.ts";

// Endereço com protocolo/www, ou domínio com TLD conhecido. As fronteiras
// (sem letra/número/hífen colado antes do nome nem depois do TLD, com \p{L}
// para pegar acentos) evitam apagar texto comum: "Av.Brasil", "R.Coronel",
// "Ed.Topázio" não são links.
const URL_RE =
  /(?:(?:https?|ftp):\/\/|www\.)[^\s<>"']+|(?<![\p{L}\d.-])[\p{L}\d-]+(?:\.[\p{L}\d-]+)*\.(?:com|net|org|br|io|app|link|xyz|info|me|co|ly|site|online|top|click|shop|pro|biz)(?:\.[a-z]{2})?(?![\p{L}\d-])(?:\/[^\s<>"']*)?/giu;

/** Troca endereços da web por "[link removido]" (só no e-mail). */
export function semLinks(t: string): string {
  return t.replace(URL_RE, "[link removido]");
}

/** Texto do usuário pronto para entrar no HTML do e-mail. */
export function textoEmail(t: string | null | undefined, max = 300): string {
  const limpo = semLinks(String(t ?? "").replace(/\s+/g, " ").trim());
  const curto = limpo.length > max ? `${limpo.slice(0, max)}…` : limpo;
  return escaparHtml(curto);
}

/** Mesmo tratamento para a versão TEXTO (WhatsApp/multipart): sem links. */
export function textoPlano(t: string | null | undefined, max = 300): string {
  const limpo = semLinks(String(t ?? "").replace(/\s+/g, " ").trim());
  return limpo.length > max ? `${limpo.slice(0, max)}…` : limpo;
}
