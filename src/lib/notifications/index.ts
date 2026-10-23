import { sendEmail, isEmailConfigured } from "./email";
import { sendWhatsapp, isWhatsappConfigured } from "./whatsapp";
import { processarPush } from "./push-servidor";
import { textoDaDecisao, type DadosDaDecisao } from "./regra-push";
import { SITE_URL } from "@/lib/site";
import { montarNotificacao, urlInterna } from "./montar-email";
import { primeiroNome } from "@/lib/display-name";
import { textoEmail, textoPlano } from "./texto-seguro";
import { TEMPLATES, type NotificationEvent } from "./eventos-email";
import { eventoDesligadoPelaPessoa } from "@/config/matriz-notificacoes";
import { createAdminClient } from "@/lib/supabase/admin";

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
const EVENTOS_INTERNOS = new Set<NotificationEvent>(["chamado_equipe", "documento_recebido", "parceria_equipe", "alerta_backup_falhou", "alerta_email_falhou"]);

/**
 * Prompt 44 (item 4): a pessoa desligou a categoria deste evento em /dashboard/notificacoes (mensagens, lembretes,
 * outros avisos)? Decisão e segurança nunca desligam; alerta da equipe segue a chave do admin, não esta.
 * Sem banco ou sem a 0227, nada é desligado.
 */
async function desligadoPelaPessoa(userId: string, event: NotificationEvent): Promise<boolean> {
  if (!eventoDesligadoPelaPessoa(event, ["mensagens", "lembretes", "outros"])) return false;
  const admin = createAdminClient();
  if (!admin) return false;
  const { data, error } = await admin.from("profiles").select("notif_categorias_desligadas").eq("id", userId).maybeSingle();
  if (error) return false;
  return eventoDesligadoPelaPessoa(event, (data as { notif_categorias_desligadas?: string[] | null } | null)?.notif_categorias_desligadas);
}

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
  /**
   * Sem push nenhum, por decisão de quem chama (o e-mail sai normalmente). O silêncio 22h–7h NÃO é mais passado
   * aqui: o notify() decide pela matriz e pela regra única (Prompt 44, push-servidor.ts).
   */
  semPush?: boolean;
  /** Prazo que vence no próprio dia (ex.: manutenção urgente): o push fura o silêncio das 22h–7h. */
  prazoHoje?: boolean;
  /** Mensagem nova: a conversa (sem push se aberta há 10 min; agrupado) e o primeiro nome de quem escreveu. */
  conversationId?: string;
  remetenteNome?: string | null;
  /** Texto da decisão no push ("Nova proposta de R$ 3.200 para o Apto Santa Mônica: responda até amanhã"). */
  decisao?: DadosDaDecisao;
}): Promise<NotifyResult> {
  const base = TEMPLATES[params.event];
  const tpl = {
    ...base,
    ...(params.subject ? { subject: textoPlano(params.subject, 120) } : {}),
    ...(params.body ? { body: params.body } : {}),
    ...(params.ctaLabel ? { cta: params.ctaLabel } : {}),
  };
  const result: NotifyResult = { email: false, whatsapp: false };
  if (params.userId && !params.interno && !EVENTOS_INTERNOS.has(params.event)) {
    if (await desligadoPelaPessoa(params.userId, params.event).catch(() => false)) return result;
  }
  // Saudação SEMPRE pela fonte única (item 3): primeiro nome, e nunca o e-mail
  // cru — se `name` vier como e-mail (fallback comum), vira saudação neutra.
  const nome = primeiroNome(params.name);
  // O nome é texto do usuário: no HTML vai escapado e sem links; no texto puro
  // (e-mail multipart, WhatsApp), só sem links.
  const nomeHtml = textoEmail(nome, 40);
  const nomeTexto = textoPlano(nome, 40);

  // PUSH em PARALELO ao e-mail: dispara já, sem await aqui (não atrasa nada). A MATRIZ decide (Prompt 44): evento sem
  // canal push nunca vai; no silêncio, só segurança e prazo do dia; o resto espera as 7h (push_adiados).
  // Conteúdo GENÉRICO (só o evento + link) — nunca contato, sobrenome ou valores.
  const pushPromise = params.userId && !params.semPush
    ? comLimite(
        processarPush({
          userId: params.userId,
          event: params.event,
          title: tpl.subject,
          // Sem nome nem contato; com a decisão, o texto dela (valor só para quem é parte).
          body: (params.decisao && textoDaDecisao(params.event, params.decisao, new Date())) || tpl.body(),
          url: urlInterna(params.pushUrl),
          prazoHoje: params.prazoHoje,
          conversationId: params.conversationId,
          remetenteNome: params.remetenteNome,
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
      // Prompt 44 (item 3): e-mail que não saiu vira alerta operacional (1 por hora, só push e central).
      if (r.error && params.event !== "alerta_email_falhou") {
        void import("./alertas-operacionais").then((m) => m.alertarFalhaDeEmail()).catch(() => null);
      }
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
    if (pr && "sent" in pr) result.push = pr.sent > 0;
    else result.push = false;
  }

  return result;
}
