import { sendEmail, isEmailConfigured } from "./email";
import { sendWhatsapp, isWhatsappConfigured } from "./whatsapp";
import { sendPush } from "./push";
import { brandedNotification, notificationText, emailImage } from "./templates";
import { SITE_URL, SUPORTE_EMAIL } from "@/lib/site";
import { primeiroNome } from "@/lib/display-name";
import { textoEmail, textoPlano } from "./texto-seguro";
import { TEMPLATES, type NotificationEvent } from "./eventos-email";

export { isEmailConfigured, isWhatsappConfigured };
export type { NotificationEvent };

/** Aceita só caminho interno ("/rota"), nunca "//" nem URL externa (mesma regra do ?next=). */
function urlInterna(u: string | undefined, fallback = "/dashboard"): string {
  return u && u[0] === "/" && u[1] !== "/" && u[1] !== "\\" ? u : fallback;
}

/** Garante que a promessa do push nunca segura o notify() além de `ms`. */
function comLimite<T>(p: Promise<T>, ms = 6000): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export interface NotifyResult {
  email: boolean | "demo";
  whatsapp: boolean | "demo";
  /** Push nativo (app). Ausente quando não há `userId`. */
  push?: boolean | "demo";
}

/**
 * Dispara uma notificação por e-mail e/ou WhatsApp conforme os canais disponíveis.
 * Best-effort: nunca lança — apenas reporta o que foi enviado.
 */
export async function notify(params: {
  event: NotificationEvent;
  email?: string;
  phone?: string;
  name?: string;
  /** Id do perfil destinatário — habilita o push nativo (app). */
  userId?: string;
  /** Rota interna para o deep-link do push (ex.: "/dashboard/leads"). */
  pushUrl?: string;
  /** HTML extra (detalhes do lead: imóvel, interessado, contato) anexado ao e-mail. */
  detailsHtml?: string;
  /** Texto extra anexado à mensagem de WhatsApp. */
  detailsText?: string;
  /** Assunto específico (texto puro; dado do usuário é limpo aqui). */
  subject?: string;
  /** E-mail sai do suporte (remetente e "responder para"): chamados. */
  doSuporte?: boolean;
}): Promise<NotifyResult> {
  const base = TEMPLATES[params.event];
  const tpl = params.subject ? { ...base, subject: textoPlano(params.subject, 120) } : base;
  const result: NotifyResult = { email: false, whatsapp: false };
  // Saudação SEMPRE pela fonte única (item 3): primeiro nome, e nunca o e-mail
  // cru — se `name` vier como e-mail (fallback comum), vira saudação neutra.
  const nome = primeiroNome(params.name);
  // O nome é texto do usuário: no HTML vai escapado e sem links; no texto puro
  // (e-mail multipart, WhatsApp), só sem links.
  const nomeHtml = textoEmail(nome, 40);
  const nomeTexto = textoPlano(nome, 40);

  // PUSH em PARALELO ao e-mail: dispara já, sem await aqui (não atrasa nada).
  // Conteúdo GENÉRICO (só o evento + link) — nunca contato, sobrenome ou valores.
  const pushPromise = params.userId
    ? comLimite(
        sendPush({
          userId: params.userId,
          title: tpl.subject,
          body: tpl.body(), // sem nome/detalhe — privacidade
          url: urlInterna(params.pushUrl),
        })
      )
    : null;

  if (params.email) {
    try {
      // Detalhes que já trazem um link (ex.: "Responder pela plataforma") ficam
      // com ele; os demais ganham UM botão para a tela EXATA do evento
      // (a mesma do push) — nunca a home. Com o app instalado, o link abre o app.
      const cta = params.detailsHtml && /<a\s/i.test(params.detailsHtml)
        ? undefined
        : { label: tpl.cta, url: `${SITE_URL}${urlInterna(params.pushUrl, tpl.path)}` };
      const html = brandedNotification({
        title: tpl.subject,
        intro: tpl.body(nomeHtml),
        detailsHtml: params.detailsHtml,
        cta,
        // Só depois que a versão do app com links diretos estiver nas lojas.
        outro: process.env.APP_LINKS_ATIVO === "on" ? "Se você tem o app Viva Nomads, ele abre direto no app." : undefined,
        image: emailImage(tpl.img, tpl.subject),
      });
      const text = notificationText({
        title: tpl.subject,
        intro: tpl.body(nomeTexto),
        detailsText: params.detailsText,
        cta,
      });
      const r = await sendEmail({
        to: params.email,
        subject: tpl.subject,
        html,
        text,
        ...(params.doSuporte ? { from: `Viva Nomads Suporte <${SUPORTE_EMAIL}>`, replyTo: SUPORTE_EMAIL } : {}),
      });
      result.email = r.demo ? "demo" : !r.error;
    } catch {
      result.email = false;
    }
  }

  if (params.phone) {
    try {
      const message = tpl.body(nomeTexto) + (params.detailsText ? `\n\n${params.detailsText}` : "");
      const r = await sendWhatsapp({ phone: params.phone, message });
      result.whatsapp = r.demo ? "demo" : r.ok;
    } catch {
      result.whatsapp = false;
    }
  }

  if (pushPromise) {
    const pr = await pushPromise; // já estava rodando em paralelo
    if (pr && "demo" in pr) result.push = "demo";
    else if (pr && "sent" in pr) result.push = pr.sent > 0;
    else result.push = false;
  }

  return result;
}
