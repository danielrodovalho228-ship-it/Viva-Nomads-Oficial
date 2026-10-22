import { sendEmail, isEmailConfigured } from "./email";
import { sendWhatsapp, isWhatsappConfigured } from "./whatsapp";
import { sendPush } from "./push";
import { SITE_URL } from "@/lib/site";
import { montarNotificacao, urlInterna } from "./montar-email";
import { primeiroNome } from "@/lib/display-name";
import { textoEmail, textoPlano } from "./texto-seguro";
import { TEMPLATES, type NotificationEvent } from "./eventos-email";

export { isEmailConfigured, isWhatsappConfigured };
export type { NotificationEvent };

/** Garante que a promessa do push nunca segura o notify() além de `ms`. */
function comLimite<T>(p: Promise<T>, ms = 6000): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/** Eventos que só vão para a equipe: remetente de sistema e assunto sem a marca. */
const EVENTOS_INTERNOS = new Set<NotificationEvent>(["chamado_equipe", "documento_recebido", "parceria_equipe"]);

/** E-mails de documento, verificação e segurança: sem List-Unsubscribe (a pessoa precisa receber). */
const SEM_GERENCIAR_AVISOS = new Set<NotificationEvent>(["documento_aprovado", "documento_recusado", "checklist_aprovado", "checklist_recusado", "verification_ready"]);

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
  /** Frase de abertura específica (no lugar da do evento); recebe o primeiro nome já tratado. */
  body?: (nome?: string) => string;
  /** Rótulo específico do botão (o destino é o pushUrl). */
  ctaLabel?: string;
  /** Aviso só para a equipe (alerta de chamado, documento na fila): remetente de sistema, assunto como veio. */
  interno?: boolean;
  /** Sem push (horário de silêncio, Prompt 38): o e-mail sai normalmente. */
  semPush?: boolean;
}): Promise<NotifyResult> {
  const base = TEMPLATES[params.event];
  const tpl = {
    ...base,
    ...(params.subject ? { subject: textoPlano(params.subject, 120) } : {}),
    ...(params.body ? { body: params.body } : {}),
    ...(params.ctaLabel ? { cta: params.ctaLabel } : {}),
  };
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
  const pushPromise = params.userId && !params.semPush
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
      const interno = !!params.interno || EVENTOS_INTERNOS.has(params.event);
      // Mesma montagem do teste de auditoria (montar-email.ts): assunto com a marca, imagem do tema, um botão.
      const m = montarNotificacao({
        siteUrl: SITE_URL,
        event: params.event,
        nomeHtml,
        nomeTexto,
        subject: tpl.subject,
        body: tpl.body,
        ctaLabel: tpl.cta,
        pushUrl: params.pushUrl,
        detailsHtml: params.detailsHtml,
        detailsText: params.detailsText,
        // Só depois que a versão do app com links diretos estiver nas lojas.
        outro: process.env.APP_LINKS_ATIVO === "on" ? "Se você tem o app Viva Nomads, ele abre direto no app." : undefined,
      });
      const r = await sendEmail({
        to: params.email,
        subject: interno ? m.titulo : m.assunto,
        html: m.html,
        text: m.text,
        interno,
        imagem: m.imagem,
        // Aviso de rotina ganha o "Gerenciar avisos" no cabeçalho; segurança e documentos, não.
        ...(SEM_GERENCIAR_AVISOS.has(params.event) || interno ? {} : { gerenciarAvisosUrl: `${SITE_URL}/dashboard/notificacoes` }),
        // A caixa de e-mails de teste é gravada dentro do sendEmail (uma vez só, depois do envio aceito).
        evento: params.event,
        usuarioId: params.userId,
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
