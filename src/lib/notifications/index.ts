import { sendEmail, isEmailConfigured } from "./email";
import { sendWhatsapp, isWhatsappConfigured } from "./whatsapp";
import { sendPush } from "./push";
import { brandedNotification, notificationText, emailImage } from "./templates";
import { SITE_URL } from "@/lib/site";
import { primeiroNome } from "@/lib/display-name";
import { textoEmail, textoPlano } from "./texto-seguro";

export { isEmailConfigured, isWhatsappConfigured };

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

/** Eventos que disparam notificação no funil (sem isso o funil vaza). */
export type NotificationEvent =
  | "new_lead" // proprietário recebe um interessado
  | "new_message" // nova mensagem no chat (proprietário OU inquilino)
  | "application_received" // candidatura recebida
  | "candidatura_aceita" // proprietário aceitou a candidatura → inquilino
  | "saved_search_match" // alerta de busca salva do inquilino
  | "verification_ready" // laudo CAF pronto
  | "contract_status" // status do contrato
  | "subscription_status" // status da assinatura
  // Pedido de Moradia (Fase 4)
  | "pedido_novo_cidade" // novo pedido ativo na cidade → proprietários
  | "pedido_resposta" // proprietário respondeu → inquilino
  | "pedido_aceito" // inquilino aceitou para conversa → proprietário
  | "pedido_expirando" // pedido expira em 3 dias → inquilino
  | "pedido_moderado" // pedido ocultado pela moderação → inquilino
  // Verificação do documento do imóvel (anti-fraude) → proprietário
  | "documento_aprovado"
  | "documento_recusado"
  | "documento_recebido" // novo documento na fila → admin
  // Checklist de qualificação revisado pela equipe → proprietário
  | "checklist_aprovado"
  | "checklist_recusado";

// `img` = chave da imagem de assunto (public/media/email/<img>.jpg).
const TEMPLATES: Record<NotificationEvent, { subject: string; body: (n?: string) => string; img: string }> = {
  new_lead: { subject: "Novo interessado no seu imóvel", body: (n) => `Olá${n ? " " + n : ""}, você recebeu um novo interessado no Viva Nomads.`, img: "novo-interessado" },
  new_message: { subject: "Você tem uma nova mensagem no Viva Nomads", body: (n) => `Olá${n ? " " + n : ""}, você recebeu uma nova mensagem no Viva Nomads.`, img: "nova-mensagem" },
  application_received: { subject: "Candidatura recebida", body: () => "Recebemos sua candidatura. O proprietário foi notificado.", img: "candidatura-recebida" },
  candidatura_aceita: { subject: "Sua candidatura foi aceita", body: (n) => `Boa notícia${n ? ", " + n : ""}! O proprietário aceitou sua candidatura. A conversa está liberada em Mensagens — a negociação segue toda pela plataforma.`, img: "nova-mensagem" },
  saved_search_match: { subject: "Novo imóvel para sua busca", body: () => "Um imóvel novo combina com sua busca salva no Viva Nomads.", img: "transacional" },
  verification_ready: { subject: "Sua verificação está pronta", body: () => "A conferência da sua identidade foi concluída. Veja o resultado no painel.", img: "candidatura-recebida" },
  contract_status: { subject: "Atualização do seu contrato", body: () => "Há uma atualização no seu contrato de locação.", img: "pedido-resposta" },
  subscription_status: { subject: "Atualização da sua assinatura", body: () => "Há uma atualização na sua assinatura Viva Nomads.", img: "transacional" },
  pedido_novo_cidade: { subject: "Novo pedido de moradia na sua cidade", body: (n) => `Olá${n ? " " + n : ""}, um inquilino publicou um pedido de moradia na cidade de um dos seus imóveis. Veja se algum atende.`, img: "transacional" },
  pedido_resposta: { subject: "Um proprietário respondeu ao seu pedido", body: (n) => `Olá${n ? " " + n : ""}, um proprietário respondeu ao seu pedido de moradia com um imóvel. Veja e aceite para conversar.`, img: "pedido-resposta" },
  pedido_aceito: { subject: "Seu imóvel foi aceito para conversa", body: (n) => `Olá${n ? " " + n : ""}, um inquilino aceitou sua resposta e abriu a conversa. Responda pela plataforma.`, img: "nova-mensagem" },
  pedido_expirando: { subject: "Seu pedido de moradia expira em breve", body: (n) => `Olá${n ? " " + n : ""}, seu pedido de moradia expira em até 3 dias. Renove ou marque como atendido se já resolveu.`, img: "transacional" },
  pedido_moderado: { subject: "Seu pedido de moradia foi ocultado", body: (n) => `Olá${n ? " " + n : ""}, seu pedido de moradia foi ocultado pela moderação. Veja o motivo e ajuste se necessário.`, img: "transacional" },
  documento_aprovado: { subject: "Documentação aprovada — você já pode publicar", body: (n) => `Olá${n ? " " + n : ""}, a documentação do seu imóvel foi verificada e aprovada. Seu anúncio já pode ser publicado.`, img: "candidatura-recebida" },
  documento_recusado: { subject: "Documentação não aprovada", body: (n) => `Olá${n ? " " + n : ""}, a documentação enviada não pôde ser aprovada. Veja o motivo, ajuste e reenvie para liberar a publicação.`, img: "pedido-resposta" },
  checklist_aprovado: { subject: "Qualificação do imóvel aprovada", body: (n) => `Olá${n ? " " + n : ""}, a equipe Viva Nomads revisou e aprovou a qualificação do seu imóvel.`, img: "candidatura-recebida" },
  checklist_recusado: { subject: "Qualificação do imóvel não aprovada", body: (n) => `Olá${n ? " " + n : ""}, a equipe Viva Nomads revisou a qualificação do seu imóvel e ela não foi aprovada. Veja o motivo, ajuste e envie de novo.`, img: "pedido-resposta" },
  documento_recebido: { subject: "Novo documento de imóvel para conferir", body: () => "Um proprietário enviou a documentação do imóvel. Há um item aguardando conferência na fila de moderação.", img: "transacional" },
};

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
}): Promise<NotifyResult> {
  const tpl = TEMPLATES[params.event];
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
      // Eventos com detailsHtml já trazem seu próprio botão (ex.: "Responder
      // pela plataforma"); os demais ganham um CTA padrão para o painel.
      const cta = params.detailsHtml
        ? undefined
        : { label: "Abrir no Viva Nomads", url: `${SITE_URL}/dashboard` };
      const html = brandedNotification({
        title: tpl.subject,
        intro: tpl.body(nomeHtml),
        detailsHtml: params.detailsHtml,
        cta,
        image: emailImage(tpl.img, tpl.subject),
      });
      const text = notificationText({
        title: tpl.subject,
        intro: tpl.body(nomeTexto),
        detailsText: params.detailsText,
        cta,
      });
      const r = await sendEmail({ to: params.email, subject: tpl.subject, html, text });
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
