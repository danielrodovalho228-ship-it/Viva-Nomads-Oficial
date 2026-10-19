/*
  E-mail transacional (Resend). Sem RESEND_API_KEY, opera em modo demonstração
  (apenas registra no console/retorno). Docs: https://resend.com/docs
*/
import { integracoesSimuladas, registrarSimulado } from "../integracoes.ts";

export function isEmailConfigured() {
  return !!process.env.RESEND_API_KEY && !integracoesSimuladas();
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
  /** Anexos (ex.: o PDF do recibo). Conteúdo em base64. */
  attachments?: { filename: string; content: string }[];
  /** Remetente específico (ex.: o suporte nos e-mails de chamado). Padrão: RESEND_FROM. */
  from?: string;
  /** Para onde vai a resposta do destinatário. */
  replyTo?: string;
}): Promise<EmailResult> {
  const outbox = process.env.EMAIL_TEST_OUTBOX;
  if (outbox && process.env.NODE_ENV !== "production") {
    await captureToOutbox(outbox, params);
    return { demo: true, captured: true };
  }

  // Laboratório com o Resend falso (LAB_RESEND_URL, só com INTEGRACOES_SIMULADAS=on — nunca em produção): o envio
  // continua registrado no LAB_OUTBOX e também passa por um servidor que confere o formato como o Resend e devolve
  // um id, para o teste provar "enviado com resend_id" e o caminho de erro (scripts/lab/resend-falso.mjs).
  const resendFalso = integracoesSimuladas() ? process.env.LAB_RESEND_URL : undefined;

  if (!isEmailConfigured()) {
    // Laboratório: o corpo vai em texto puro (sem tags) para os testes conferirem o conteúdo; o destino de cada botão
    // ou link fica entre parênteses ("Conferir autenticidade (https://…/conferir/…)"), senão o teste não o veria.
    const corpo = params.html
      .replace(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, rotulo: string) => `${rotulo} (${href}) `)
      .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
    await registrarSimulado("email", { para: params.to, assunto: params.subject, anexos: params.attachments?.length ?? 0, corpo });
    if (!resendFalso) return { demo: true };
  }

  const corpo = JSON.stringify({
    from: params.from ?? process.env.RESEND_FROM ?? "Viva Nomads <nao-responder@vivanomads.com.br>",
    ...(params.replyTo ? { reply_to: params.replyTo } : {}),
    to: params.to,
    subject: params.subject,
    html: params.html,
    ...(params.text ? { text: params.text } : {}),
    ...(params.attachments?.length ? { attachments: params.attachments } : {}),
  });
  const url = resendFalso ? `${resendFalso.replace(/\/$/, "")}/emails` : "https://api.resend.com/emails";
  const chave = resendFalso ? "re_lab" : process.env.RESEND_API_KEY;

  // O Resend aceita 2 pedidos por segundo por conta. O recibo sai logo depois dos avisos da confirmação (as mesmas
  // duas caixas, no mesmo segundo): a recusa 429 era descartada e o recibo não chegava. Agora o 429 espera e tenta de
  // novo (até 3 vezes), e qualquer outra recusa volta com o motivo do Resend.
  for (let tentativa = 1; ; tentativa++) {
    let res: Response;
    try {
      res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` }, body: corpo });
    } catch (e) {
      const error = `Resend sem resposta: ${semDadosPessoais(e instanceof Error ? e.message : String(e))}`;
      console.error("[email] falhou:", error);
      return { demo: false, error };
    }
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      if (!data.id) {
        console.error("[email] Resend respondeu sem id");
        return { demo: false, error: `Resend ${res.status}: resposta sem id` };
      }
      return { demo: false, id: data.id };
    }
    if (res.status === 429 && tentativa < 3) {
      const espera = Math.min(5, Math.max(1, Number(res.headers.get("retry-after")) || tentativa)) * 1000;
      await new Promise((r) => setTimeout(r, espera));
      continue;
    }
    const error = erroResend(res.status, await res.text().catch(() => ""));
    console.error("[email] recusado:", error);
    return { demo: false, error };
  }
}

/** Tira endereços de e-mail e números longos (telefone, CPF) de uma mensagem antes de ir para o log ou a fila. */
export function semDadosPessoais(s: string): string {
  return s
    .replace(/[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+/g, "[e-mail]")
    .replace(/\(?\d[\d.\-\s()/]{8,}\d/g, "[número]")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * O corpo do erro do Resend ({ statusCode, message, name }) vira "Resend 422: validation_error: …", sem dados
 * pessoais e curto o bastante para a fila (o motivo cabe em 300 caracteres).
 */
export function erroResend(status: number, corpo: string): string {
  let nome = "";
  let mensagem = corpo;
  try {
    const j = JSON.parse(corpo) as { name?: unknown; message?: unknown };
    nome = typeof j.name === "string" ? j.name : "";
    mensagem = typeof j.message === "string" ? j.message : "";
  } catch {
    /* corpo que não é JSON vai como texto */
  }
  const detalhe = semDadosPessoais([nome, mensagem].filter(Boolean).join(": ")).slice(0, 200);
  return `Resend ${status}${detalhe ? `: ${detalhe}` : ""}`;
}
