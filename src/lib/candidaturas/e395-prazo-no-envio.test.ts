/* Roda: node --test src/lib/candidaturas/e395-prazo-no-envio.test.ts
  E395 (família E314): o prazo de resposta "em até 1 dia útil" aparece no MOMENTO do envio da candidatura: tela de sucesso (as duas),
  cartão "Enviada", lista de Candidaturas (o mesmo cartão), e os dois e-mails do morador. Uma constante só. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRAZO_RESPOSTA_CANDIDATURA, PROXIMO_PASSO_CANDIDATURA } from "./status.ts";
import { proximoPassoCandidatura } from "../notifications/dados-candidatura.ts";

test("E395: uma constante com o prazo oficial, usada no 'Enviada' e no 'Em análise'", () => {
  assert.equal(PRAZO_RESPOSTA_CANDIDATURA, "em até 1 dia útil");
  assert.ok(PROXIMO_PASSO_CANDIDATURA.enviada!.agora.includes(PRAZO_RESPOSTA_CANDIDATURA));
  assert.ok(PROXIMO_PASSO_CANDIDATURA.em_analise!.agora.includes(PRAZO_RESPOSTA_CANDIDATURA));
});

test("E395: o e-mail 'sua candidatura foi enviada' (próximo passo) diz o prazo; o do dono não muda", () => {
  assert.match(proximoPassoCandidatura("enviada"), /em até 1 dia útil/);
  assert.doesNotMatch(proximoPassoCandidatura("nova"), /dia útil/);
});

test("E395: o e-mail 'Candidatura enviada' (application_received) e as duas telas de sucesso dizem o prazo", () => {
  const ev = readFileSync("src/lib/notifications/eventos-email.ts", "utf8");
  assert.match(ev, /application_received: \{ subject: "Candidatura enviada", body: \(\) => "Recebemos sua candidatura\. O proprietário foi notificado e a resposta chega em até 1 dia útil\."/);
  const d = readFileSync("src/app/(public)/imoveis/[id]/property-detail.tsx", "utf8");
  assert.equal((d.match(/PRAZO_RESPOSTA_CANDIDATURA/g) ?? []).length >= 3, true, "import + as duas telas");
  assert.match(d, /data-testid="candidatura-prazo">O proprietário recebeu seu perfil e responde pela plataforma, \{PRAZO_RESPOSTA_CANDIDATURA\}/);
});
