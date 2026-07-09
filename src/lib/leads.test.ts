import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLeadNotification, LEAD_KIND_LABEL, type LeadKind } from "./leads.ts";

// Dados sensíveis que NUNCA podem aparecer na notificação ao proprietário.
const EMAIL = "ana.sobrenome@gmail.com";
const PHONE = "(34) 99999-0001";
const SOBRENOME = "Carvalho";

function all(kind: LeadKind) {
  return buildLeadNotification(kind, "Studio no Centro", {
    name: `Ana ${SOBRENOME}`,
    email: EMAIL,
    phone: PHONE,
  });
}

// 1–3: nenhum canal (HTML e texto) expõe e-mail, para qualquer tipo de lead.
for (const kind of ["duvida", "visita", "candidatura"] as LeadKind[]) {
  test(`[${kind}] NÃO vaza e-mail (html + texto)`, () => {
    const { detailsHtml, detailsText } = all(kind);
    assert.ok(!detailsHtml.includes(EMAIL), "e-mail no HTML");
    assert.ok(!detailsText.includes(EMAIL), "e-mail no texto");
    assert.ok(!detailsHtml.includes("mailto:"), "mailto no HTML");
  });
}

// 4: nenhum canal expõe telefone.
test("NÃO vaza telefone (html + texto)", () => {
  const { detailsHtml, detailsText } = all("duvida");
  assert.ok(!detailsHtml.includes(PHONE));
  assert.ok(!detailsText.includes(PHONE));
  assert.ok(!/whatsapp/i.test(detailsHtml));
});

// 5: mostra só o PRIMEIRO nome (sobrenome não aparece antes do aceite).
test("mostra só o primeiro nome (sem sobrenome)", () => {
  const { detailsHtml, detailsText } = all("visita");
  assert.ok(detailsHtml.includes("Ana"));
  assert.ok(!detailsHtml.includes(SOBRENOME), "sobrenome no HTML");
  assert.ok(!detailsText.includes(SOBRENOME), "sobrenome no texto");
});

// 6: tem o botão/atalho "Responder pela plataforma" apontando para o site.
test("tem CTA para responder DENTRO da plataforma", () => {
  const { detailsHtml, detailsText } = all("candidatura");
  assert.match(detailsHtml, /Responder pela plataforma/);
  assert.match(detailsHtml, /href="https?:\/\/[^"]+\/dashboard\/mensagens"/);
  assert.match(detailsText, /\/dashboard\/mensagens/);
});

// 7: vocabulário — nunca "lead" no conteúdo ao usuário.
test("vocabulário: sem 'lead' no corpo", () => {
  const { detailsHtml, detailsText } = all("duvida");
  assert.ok(!/lead/i.test(detailsHtml), "'lead' no HTML");
  assert.ok(!/lead/i.test(detailsText), "'lead' no texto");
});

// 8: o tipo do lead aparece rotulado (dúvida/visita/candidatura).
test("rotula o tipo do interessado", () => {
  for (const kind of ["duvida", "visita", "candidatura"] as LeadKind[]) {
    const { detailsHtml } = all(kind);
    assert.ok(detailsHtml.includes(LEAD_KIND_LABEL[kind]));
  }
});

// 9: nome ausente cai para "Interessado" sem quebrar nem vazar.
test("sem nome: fallback 'Interessado'", () => {
  const { detailsHtml, detailsText } = buildLeadNotification("duvida", "Apto", {});
  assert.ok(detailsHtml.includes("Interessado"));
  assert.ok(!detailsHtml.includes(EMAIL));
  assert.ok(detailsText.includes("Interessado"));
});

// 10: e-mail/telefone passados são IGNORADOS mesmo se o chamador insistir.
test("ignora email/phone injetados pelo chamador (defesa em profundidade)", () => {
  const { detailsHtml, detailsText } = buildLeadNotification("visita", "Casa", {
    name: "Bruno Souza",
    email: "bruno@x.com",
    phone: "34988887777",
  });
  assert.ok(!detailsHtml.includes("bruno@x.com"));
  assert.ok(!detailsHtml.includes("34988887777"));
  assert.ok(!detailsText.includes("bruno@x.com"));
  assert.ok(!detailsText.includes("34988887777"));
  assert.ok(!detailsHtml.includes("Souza"), "sobrenome vazou");
});
