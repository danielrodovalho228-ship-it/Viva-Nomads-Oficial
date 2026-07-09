/*
  Tipos e montagem do aviso de lead (dúvida, visita, candidatura). Módulo puro
  (sem "use server") para ser reusado tanto pela server action `requestLead`
  quanto pela rota de teste /api/test-lead — assim o e-mail simulado é idêntico
  ao que o proprietário recebe de verdade ao clicar nos botões do imóvel.
*/

// Base do site (sem "/" final). Inline aqui — módulo puro, testável sem imports
// de valor com alias @/ (espelha src/lib/site.ts).
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://vivanomads.com.br");

export type LeadKind = "duvida" | "visita" | "candidatura";

export const LEAD_KIND_LABEL: Record<LeadKind, string> = {
  duvida: "Nova dúvida",
  visita: "Pedido de visita",
  candidatura: "Nova candidatura",
};

/** Primeira mensagem que o interessado envia ao proprietário no chat. */
export const LEAD_KIND_MSG: Record<LeadKind, (title: string) => string> = {
  duvida: (t) => `Olá! Tenho interesse no imóvel "${t}". Pode me ajudar com uma dúvida?`,
  visita: (t) => `Olá! Gostaria de agendar uma visita ao imóvel "${t}". Quais horários você tem?`,
  candidatura: (t) => `Olá! Quero me candidatar ao imóvel "${t}". Podemos seguir com a documentação?`,
};

export interface LeadTenant {
  name?: string;
  /**
   * PRIVACIDADE (regra de ouro + LGPD): e-mail/telefone do interessado NÃO
   * entram na notificação. O proprietário fala com o interessado DENTRO da
   * plataforma (onde fica registrado). Estes campos permanecem na interface só
   * por compatibilidade dos chamadores — são deliberadamente ignorados aqui.
   */
  email?: string;
  phone?: string;
}

/**
 * Monta o corpo (HTML para e-mail, texto para WhatsApp) do aviso ao proprietário.
 * NUNCA expõe contato do interessado: só o PRIMEIRO nome + imóvel + botão para
 * responder na plataforma. "Notificação avisa, plataforma resolve."
 */
export function buildLeadNotification(
  kind: LeadKind,
  propertyTitle: string,
  tenant: LeadTenant
): { detailsHtml: string; detailsText: string } {
  const first = (tenant.name || "Interessado").trim().split(/\s+/)[0] || "Interessado";
  const link = `${SITE_URL}/dashboard/mensagens`;
  const detailsHtml =
    `<p style="margin:16px 0 6px"><strong>${LEAD_KIND_LABEL[kind]}</strong> — ${propertyTitle}</p>` +
    `<p style="margin:0 0 12px">Interessado: <strong>${first}</strong></p>` +
    `<p style="margin:0"><a href="${link}" style="display:inline-block;background:#1e63d0;color:#fff;padding:11px 20px;border-radius:999px;text-decoration:none;font-weight:600">Responder pela plataforma</a></p>` +
    `<p style="color:#6b7280;font-size:12px;margin:12px 0 0">Converse pela plataforma — assim tudo fica registrado e protegido. O contato é revelado conforme o andamento. Não responda este e-mail.</p>`;
  const detailsText =
    `${LEAD_KIND_LABEL[kind]} — ${propertyTitle}\nInteressado: ${first}\n\nResponda pela plataforma (a conversa fica registrada): ${link}`;
  return { detailsHtml, detailsText };
}
