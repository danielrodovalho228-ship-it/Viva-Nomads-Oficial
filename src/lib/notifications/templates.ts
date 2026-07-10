/*
  Templates de e-mail brandados (Viva Nomads). HTML e-mail-safe (tabelas +
  estilos inline). O logo é a imagem hospedada em /email-mark.png + o texto
  "VivaNomads" colorido (aparece mesmo com imagens bloqueadas).

  Usados pela rota /api/test-email?all=1 para enviar um exemplo de cada modelo.
*/
import { SITE_URL } from "@/lib/site";

const MARK = `${SITE_URL}/email-mark.png`;

function layout(inner: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#f1f5f4;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f4;padding:24px 12px;"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
      <tr><td style="padding:22px 32px;border-bottom:1px solid #eef2f1;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;"><img src="${MARK}" width="34" height="34" alt="Viva Nomads" style="display:block;border:0;"></td>
          <td style="vertical-align:middle;padding-left:10px;font-size:20px;font-weight:800;letter-spacing:-0.5px;"><span style="color:#1E63D0;">Viva</span><span style="color:#6CBE2A;">Nomads</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:32px;">${inner}</td></tr>
      <tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #eef2f1;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">Viva Nomads — locação mobiliada por temporada (30 a 180 dias).<br>Se você não solicitou este e-mail, pode ignorá-lo com segurança.</p>
      </td></tr>
    </table>
  </td></tr></table>
  </body></html>`;
}

function button(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#1E63D0;">
    <a href="${url}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#fff;text-decoration:none;border-radius:10px;">${label}</a>
  </td></tr></table>`;
}

/** E-mail com título, texto e botão (CTA). */
export function brandedEmail(o: { title: string; intro: string; button: string; url: string; outro?: string }): string {
  return layout(
    `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#143C8C;">${o.title}</h1>
     <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#374151;">${o.intro}</p>
     ${button(o.url, o.button)}
     ${o.outro ? `<p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">${o.outro}</p>` : ""}`
  );
}

/** E-mail com código (OTP) em destaque, sem botão. */
export function brandedCodeEmail(o: { title: string; intro: string; code: string; outro?: string }): string {
  return layout(
    `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#143C8C;">${o.title}</h1>
     <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#374151;">${o.intro}</p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr><td align="center" style="padding:18px;background:#f2fbe9;border:1px dashed #8FD63A;border-radius:12px;">
       <span style="font-size:34px;font-weight:800;letter-spacing:8px;color:#143C8C;">${o.code}</span>
     </td></tr></table>
     ${o.outro ? `<p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">${o.outro}</p>` : ""}`
  );
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
}): string {
  const gapAfterIntro = o.detailsHtml || o.cta ? "18px" : "0";
  return layout(
    `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#143C8C;">${o.title}</h1>
     <p style="margin:0 0 ${gapAfterIntro};font-size:15px;line-height:1.6;color:#374151;">${o.intro}</p>
     ${o.detailsHtml ?? ""}
     ${o.cta ? `<div style="margin-top:20px;">${button(o.cta.url, o.cta.label)}</div>` : ""}
     ${o.outro ? `<p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">${o.outro}</p>` : ""}`
  );
}

/** Versão TEXTO PURO (multipart) da notificação — mesma informação, sem HTML. */
export function notificationText(o: {
  title: string;
  intro: string;
  detailsText?: string;
  cta?: { label: string; url: string };
}): string {
  return [
    o.title,
    "",
    o.intro,
    o.detailsText ? `\n${o.detailsText}` : "",
    o.cta ? `\n${o.cta.label}: ${o.cta.url}` : "",
    "\n— Viva Nomads · locação mobiliada por temporada",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export interface SampleEmail {
  key: string;
  subject: string;
  html: string;
}

/** Um exemplo de cada modelo (com dados fictícios) para revisar o visual. */
export function sampleEmails(): SampleEmail[] {
  const url = `${SITE_URL}/auth/callback?code=exemplo`;
  return [
    {
      key: "confirmar-cadastro",
      subject: "Confirme seu e-mail · Viva Nomads",
      html: brandedEmail({
        title: "Confirme seu e-mail",
        intro: "Falta só um passo para ativar sua conta no Viva Nomads. Clique no botão abaixo para confirmar seu e-mail e começar.",
        button: "Confirmar e-mail",
        url,
        outro: "Por segurança, este link expira em algumas horas.",
      }),
    },
    {
      key: "redefinir-senha",
      subject: "Redefinir sua senha · Viva Nomads",
      html: brandedEmail({
        title: "Redefinir sua senha",
        intro: "Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha.",
        button: "Criar nova senha",
        url,
        outro: "Se não foi você, ignore este e-mail — sua senha continua a mesma.",
      }),
    },
    {
      key: "link-de-acesso",
      subject: "Seu link de acesso · Viva Nomads",
      html: brandedEmail({
        title: "Seu link de acesso",
        intro: "Use o botão abaixo para entrar no Viva Nomads com segurança, sem precisar de senha.",
        button: "Entrar agora",
        url,
        outro: "Este link é de uso único e expira em breve.",
      }),
    },
    {
      key: "convite",
      subject: "Você foi convidado · Viva Nomads",
      html: brandedEmail({
        title: "Você foi convidado para o Viva Nomads",
        intro: "Você recebeu um convite para participar do Viva Nomads. Clique no botão abaixo para criar sua conta.",
        button: "Aceitar convite",
        url,
      }),
    },
    {
      key: "trocar-email",
      subject: "Confirme seu novo e-mail · Viva Nomads",
      html: brandedEmail({
        title: "Confirme seu novo e-mail",
        intro: "Para concluir a troca de endereço de e-mail da sua conta, confirme este novo e-mail clicando no botão abaixo.",
        button: "Confirmar novo e-mail",
        url,
        outro: "Se você não pediu essa troca, ignore este e-mail.",
      }),
    },
    {
      key: "reautenticacao",
      subject: "Seu código de verificação · Viva Nomads",
      html: brandedCodeEmail({
        title: "Confirme sua identidade",
        intro: "Para concluir uma ação sensível na sua conta, use o código de verificação abaixo:",
        code: "824519",
        outro: "O código expira em alguns minutos. Nunca compartilhe este código com ninguém.",
      }),
    },
    {
      key: "transacional",
      subject: "Novo interessado no seu imóvel · Viva Nomads",
      html: brandedEmail({
        title: "Você tem um novo interessado 🎉",
        intro:
          "Alguém demonstrou interesse no seu imóvel \"Studio premium no Centro\". Responda pela plataforma — o contato fica registrado e protegido.",
        button: "Responder pela plataforma",
        url: `${SITE_URL}/dashboard/mensagens`,
        outro: "Exemplo de e-mail transacional do app (Resend). Não expõe contato da outra parte.",
      }),
    },
  ];
}
