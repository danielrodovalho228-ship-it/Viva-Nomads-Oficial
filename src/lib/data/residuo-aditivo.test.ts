import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Resíduo da varredura ampla: o aditivo assinado pelas duas partes nunca fica sem aplicar, em silêncio, por leitura
 * falha; e o limite de 1 minuto entre códigos vale mesmo com leitura falha.
 */
const fonte = readFileSync(new URL("./estadia-actions.ts", import.meta.url), "utf8");
function corpo(nome: string): string {
  const i = fonte.search(new RegExp(`(export )?async function ${nome}\\(`));
  assert.ok(i >= 0, nome);
  return fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);
}

test("assinarAditivo: leitura falha das assinaturas avisa a equipe e não vira 'falta a outra parte'", () => {
  const f = corpo("assinarAditivo");
  const guarda = f.indexOf("if (erroAssinaturas) {");
  assert.ok(guarda >= 0);
  assert.ok(guarda < f.indexOf("const completo ="), "antes de decidir se está completo");
  assert.match(f.slice(guarda, guarda + 200), /avisarAditivoParado\(ctx\.admin, a, "assinaturas", erroAssinaturas\.message\);\s*return \{ ok: false, erro: MSG_ADITIVO_PARADO \};/);
});

test("aplicarAditivo: contrato não lido avisa a equipe em vez de quebrar", () => {
  const f = corpo("aplicarAditivo");
  const guarda = f.indexOf("if (erroContrato || !data) {");
  assert.ok(guarda >= 0);
  assert.ok(guarda < f.indexOf("blocosDepoisDoAditivo("), "antes de recalcular os blocos");
  assert.ok(guarda < f.indexOf('rpc("aplicar_aditivo"'), "antes do rpc");
});

test("avisarAditivoParado grava P2 em avisos_daniel sem lançar", () => {
  const f = corpo("avisarAditivoParado");
  assert.match(f, /from\("avisos_daniel"\)\s*\.insert\(/);
  assert.match(f, /prioridade: "P2"/);
  assert.match(f, /\.then\(undefined, \(\) => \{\}\)/);
});

test("pedirCodigoAditivo: leitura falha não fura o limite de 1 minuto", () => {
  const f = corpo("pedirCodigoAditivo");
  const guarda = f.indexOf("if (erroAtual) return");
  assert.ok(guarda >= 0 && guarda < f.indexOf("podeReenviar("));
});
