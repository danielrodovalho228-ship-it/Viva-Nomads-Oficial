import { sendEmail, isEmailConfigured } from "./email";
import { sendWhatsapp, isWhatsappConfigured } from "./whatsapp";
import { brandedNotification, notificationText, emailImage } from "./templates";
import { SITE_URL } from "@/lib/site";
import { primeiroNome } from "@/lib/display-name";

export { isEmailConfigured, isWhatsappConfigured };

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
  | "documento_recebido"; // novo documento na fila → admin

// `img` = chave da imagem de assunto (public/media/email/<img>.jpg).
const TEMPLATES: Record<NotificationEvent, { subject: string; body: (n?: string) => string; img: string }> = {
  new_lead: { subject: "Novo interessado no seu imóvel", body: (n) => `Olá${n ? " " + n : ""}, você recebeu um novo interessado no Viva Nomads.`, img: "novo-interessado" },
  new_message: { subject: "Você tem uma nova mensagem no Viva Nomads", body: (n) => `Olá${n ? " " + n : ""}, você recebeu uma nova mensagem no Viva Nomads.`, img: "nova-mensagem" },
  application_received: { subject: "Candidatura recebida", body: () => "Recebemos sua candidatura. O proprietário foi notificado.", img: "candidatura-recebida" },
  candidatura_aceita: { subject: "Sua candidatura foi aceita", body: (n) => `Boa notícia${n ? ", " + n : ""}! O proprietário aceitou sua candidatura. A conversa está liberada em Mensagens — a negociação segue toda pela plataforma.`, img: "nova-mensagem" },
  saved_search_match: { subject: "Novo imóvel para sua busca", body: () => "Um imóvel novo combina com sua busca salva no Viva Nomads.", img: "transacional" },
  verification_ready: { subject: "Sua verificação está pronta", body: () => "Seu laudo de Inquilino Verificado está disponível.", img: "candidatura-recebida" },
  contract_status: { subject: "Atualização do seu contrato", body: () => "Há uma atualização no seu contrato de locação.", img: "pedido-resposta" },
  subscription_status: { subject: "Atualização da sua assinatura", body: () => "Há uma atualização na sua assinatura Viva Nomads.", img: "transacional" },
  pedido_novo_cidade: { subject: "Novo pedido de moradia na sua cidade", body: (n) => `Olá${n ? " " + n : ""}, um inquilino publicou um pedido de moradia na cidade de um dos seus imóveis. Veja se algum atende.`, img: "transacional" },
  pedido_resposta: { subject: "Um proprietário respondeu ao seu pedido", body: (n) => `Olá${n ? " " + n : ""}, um proprietário respondeu ao seu pedido de moradia com um imóvel. Veja e aceite para conversar.`, img: "pedido-resposta" },
  pedido_aceito: { subject: "Seu imóvel foi aceito para conversa", body: (n) => `Olá${n ? " " + n : ""}, um inquilino aceitou sua resposta e abriu a conversa. Responda pela plataforma.`, img: "nova-mensagem" },
  pedido_expirando: { subject: "Seu pedido de moradia expira em breve", body: (n) => `Olá${n ? " " + n : ""}, seu pedido de moradia expira em até 3 dias. Renove ou marque como atendido se já resolveu.`, img: "transacional" },
  pedido_moderado: { subject: "Seu pedido de moradia foi ocultado", body: (n) => `Olá${n ? " " + n : ""}, seu pedido de moradia foi ocultado pela moderação. Veja o motivo e ajuste se necessário.`, img: "transacional" },
  documento_aprovado: { subject: "Documentação aprovada — você já pode publicar", body: (n) => `Olá${n ? " " + n : ""}, a documentação do seu imóvel foi verificada e aprovada. Seu anúncio já pode ser publicado.`, img: "candidatura-recebida" },
  documento_recusado: { subject: "Documentação não aprovada", body: (n) => `Olá${n ? " " + n : ""}, a documentação enviada não pôde ser aprovada. Veja o motivo, ajuste e reenvie para liberar a publicação.`, img: "pedido-resposta" },
  documento_recebido: { subject: "Novo documento de imóvel para conferir", body: () => "Um proprietário enviou a documentação do imóvel. Há um item aguardando conferência na fila de moderação.", img: "transacional" },
};

export interface NotifyResult {
  email: boolean | "demo";
  whatsapp: boolean | "demo";
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

  if (params.email) {
    try {
      // Eventos com detailsHtml já trazem seu próprio botão (ex.: "Responder
      // pela plataforma"); os demais ganham um CTA padrão para o painel.
      const cta = params.detailsHtml
        ? undefined
        : { label: "Abrir no Viva Nomads", url: `${SITE_URL}/dashboard` };
      const html = brandedNotification({
        title: tpl.subject,
        intro: tpl.body(nome),
        detailsHtml: params.detailsHtml,
        cta,
        image: emailImage(tpl.img, tpl.subject),
      });
      const text = notificationText({
        title: tpl.subject,
        intro: tpl.body(nome),
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
      const message = tpl.body(nome) + (params.detailsText ? `\n\n${params.detailsText}` : "");
      const r = await sendWhatsapp({ phone: params.phone, message });
      result.whatsapp = r.demo ? "demo" : r.ok;
    } catch {
      result.whatsapp = false;
    }
  }

  return result;
}
