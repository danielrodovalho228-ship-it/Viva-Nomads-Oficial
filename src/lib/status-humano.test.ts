import test from "node:test";
import assert from "node:assert/strict";
import { statusHumano } from "./status-humano.ts";

test("status conhecidos viram texto humano", () => {
  assert.equal(statusHumano("pendente_aceite"), "Aguardando aceite");
  assert.equal(statusHumano("aguardando_assinatura"), "Aguardando assinatura");
  assert.equal(statusHumano("encerrado_em_acerto"), "Encerrado, em acerto");
  assert.equal(statusHumano("em_andamento"), "Em andamento");
  assert.equal(statusHumano("aguardando_usuario"), "Aguardando usuário");
  assert.equal(statusHumano("removido_admin"), "Removido pela moderação");
});

test("status desconhecido nunca mostra underscore nem código cru", () => {
  const t = statusHumano("algum_status_novo");
  assert.equal(t, "Algum status novo");
  assert.doesNotMatch(t, /_/);
});

test("vazio, null e undefined não viram 'undefined' nem 'null'", () => {
  assert.equal(statusHumano(null), "—");
  assert.equal(statusHumano(undefined), "—");
  assert.equal(statusHumano(""), "—");
});

test("copiloto do admin não mostra status cru de contrato, pedido ou chamado", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../app/(dashboard)/admin/atendimento/[id]/copiloto.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(src, /\{k\.status\}/);
  assert.doesNotMatch(src, /\{x\.status\}/);
  assert.match(src, /statusHumano\(k\.status\)/);
});
