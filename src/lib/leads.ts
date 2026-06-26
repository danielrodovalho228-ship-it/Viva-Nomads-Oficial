/*
  Tipos e montagem do aviso de lead (dúvida, visita, candidatura). Módulo puro
  (sem "use server") para ser reusado tanto pela server action `requestLead`
  quanto pela rota de teste /api/test-lead — assim o e-mail simulado é idêntico
  ao que o proprietário recebe de verdade ao clicar nos botões do imóvel.
*/

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
  email?: string;
  phone?: string;
}

/** Monta o corpo (HTML para e-mail, texto para WhatsApp) com os dados do lead. */
export function buildLeadNotification(
  kind: LeadKind,
  propertyTitle: string,
  tenant: LeadTenant
): { detailsHtml: string; detailsText: string } {
  const name = tenant.name || "Interessado";
  const detailsHtml =
    `<p style="margin:16px 0 6px"><strong>${LEAD_KIND_LABEL[kind]}</strong> — ${propertyTitle}</p>` +
    `<p style="margin:0 0 4px">Interessado: <strong>${name}</strong></p>` +
    (tenant.email ? `<p style="margin:0 0 4px">E-mail: <a href="mailto:${tenant.email}">${tenant.email}</a></p>` : "") +
    (tenant.phone ? `<p style="margin:0">WhatsApp/telefone: ${tenant.phone}</p>` : "");
  const detailsText =
    `${LEAD_KIND_LABEL[kind]} — ${propertyTitle}\nInteressado: ${name}` +
    (tenant.email ? `\nE-mail: ${tenant.email}` : "") +
    (tenant.phone ? `\nWhatsApp: ${tenant.phone}` : "");
  return { detailsHtml, detailsText };
}
