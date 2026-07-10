/*
  E-mail transacional (Resend). Sem RESEND_API_KEY, opera em modo demonstração
  (apenas registra no console/retorno). Docs: https://resend.com/docs
*/

export function isEmailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

export interface EmailResult {
  demo: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  /** Versão texto puro (multipart). Melhora entregabilidade e acessibilidade. */
  text?: string;
}): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    return { demo: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM ?? "Viva Nomads <nao-responder@vivanomads.com.br>",
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(params.text ? { text: params.text } : {}),
    }),
  });

  if (!res.ok) return { demo: false, error: `Resend ${res.status}` };
  const data = (await res.json()) as { id?: string };
  return { demo: false, id: data.id };
}
