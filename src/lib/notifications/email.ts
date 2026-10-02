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
  /** true quando capturado no outbox de teste (nada saiu para a rede). */
  captured?: boolean;
}

/**
 * Captura de e-mail para testes (E2E). Com EMAIL_TEST_OUTBOX definido, o envio
 * é curto-circuitado e a mensagem é anexada (JSONL) ao arquivo apontado — nada
 * é enviado para endereços reais. Só ativa fora de produção, como salvaguarda.
 */
async function captureToOutbox(
  outbox: string,
  params: { to: string; subject: string; html: string; text?: string },
): Promise<void> {
  const { appendFile } = await import("node:fs/promises");
  const line =
    JSON.stringify({
      to: params.to,
      subject: params.subject,
      text: params.text ?? "",
      // gravamos só um trecho do HTML — o suficiente para asserção, sem ruído.
      htmlLen: params.html.length,
    }) + "\n";
  await appendFile(outbox, line, "utf8");
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  /** Versão texto puro (multipart). Melhora entregabilidade e acessibilidade. */
  text?: string;
}): Promise<EmailResult> {
  const outbox = process.env.EMAIL_TEST_OUTBOX;
  if (outbox && process.env.NODE_ENV !== "production") {
    await captureToOutbox(outbox, params);
    return { demo: true, captured: true };
  }

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
