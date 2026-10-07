import { test } from "node:test";
import assert from "node:assert/strict";
import { sendEmail } from "./email.ts";

test("e-mail de chamado sai do suporte e a resposta volta para suporte@", async () => {
  const antes = { key: process.env.RESEND_API_KEY, fetch: globalThis.fetch };
  process.env.RESEND_API_KEY = "teste";
  let corpo: Record<string, unknown> = {};
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    corpo = JSON.parse(init.body);
    return new Response(JSON.stringify({ id: "x" }), { status: 200 });
  }) as unknown as typeof fetch;
  try {
    await sendEmail({ to: "ana@exemplo.com", subject: "Recebemos seu chamado — VN-000101", html: "<p>oi</p>", from: "Viva Nomads Suporte <suporte@vivanomads.com.br>", replyTo: "suporte@vivanomads.com.br" });
    assert.equal(corpo.from, "Viva Nomads Suporte <suporte@vivanomads.com.br>");
    assert.equal(corpo.reply_to, "suporte@vivanomads.com.br");
    // Sem pedir, continua o remetente padrão e sem reply_to.
    await sendEmail({ to: "ana@exemplo.com", subject: "x", html: "<p>x</p>" });
    assert.equal(corpo.reply_to, undefined);
  } finally {
    if (antes.key === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = antes.key;
    globalThis.fetch = antes.fetch;
  }
});
