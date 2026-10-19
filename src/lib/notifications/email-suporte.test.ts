import { test } from "node:test";
import assert from "node:assert/strict";
import { sendEmail } from "./email.ts";
import { SUPORTE_EMAIL } from "../site.ts";

// Rota rápida dos e-mails, item 1: todo e-mail de cliente (chamados inclusive) sai de "Viva Nomads Brasil <suporte@…>"
// e a resposta volta para o suporte; só o e-mail interno mantém o remetente que pediu.
test("e-mail de cliente (inclusive chamado) sai do remetente único e responde ao suporte; interno mantém o dele", async () => {
  const antes = { key: process.env.RESEND_API_KEY, from: process.env.RESEND_FROM, fetch: globalThis.fetch };
  process.env.RESEND_API_KEY = "teste";
  process.env.RESEND_FROM = "Viva Nomads <nao-responder@vivanomads.com.br>";
  let corpo: Record<string, unknown> = {};
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    corpo = JSON.parse(init.body);
    return new Response(JSON.stringify({ id: "x" }), { status: 200 });
  }) as unknown as typeof fetch;
  try {
    await sendEmail({ to: "ana@exemplo.com", subject: "Recebemos seu chamado (VN-000101)", html: "<p>oi</p>" });
    assert.equal(corpo.from, `Viva Nomads Brasil <${SUPORTE_EMAIL}>`);
    assert.equal(corpo.reply_to, SUPORTE_EMAIL);
    assert.equal(corpo.subject, "Recebemos seu chamado (VN-000101) · Viva Nomads");
    // Um `from` pedido em e-mail de cliente é ignorado (RESEND_FROM também).
    await sendEmail({ to: "ana@exemplo.com", subject: "x", html: "<p>x</p>", from: "Outro <o@x.com>" });
    assert.equal(corpo.from, `Viva Nomads Brasil <${SUPORTE_EMAIL}>`);
    // Aviso de rotina leva o "Gerenciar avisos" no cabeçalho.
    await sendEmail({ to: "ana@exemplo.com", subject: "x", html: "<p>x</p>", gerenciarAvisosUrl: "https://vivanomads.com.br/dashboard/notificacoes" });
    assert.deepEqual(corpo.headers, { "List-Unsubscribe": "<https://vivanomads.com.br/dashboard/notificacoes>" });
    // Interno: remetente e assunto como vieram.
    await sendEmail({ interno: true, to: "daniel@exemplo.com", subject: "Lead B2B — Empresa", html: "<p>x</p>" });
    assert.equal(corpo.from, "Viva Nomads <nao-responder@vivanomads.com.br>");
    assert.equal(corpo.subject, "Lead B2B — Empresa");
    assert.equal(corpo.reply_to, undefined);
  } finally {
    if (antes.key === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = antes.key;
    if (antes.from === undefined) delete process.env.RESEND_FROM;
    else process.env.RESEND_FROM = antes.from;
    globalThis.fetch = antes.fetch;
  }
});
