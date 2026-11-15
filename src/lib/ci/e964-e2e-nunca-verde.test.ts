/*
  E964 — o check E2E aparecia VERDE sem ter rodado (#3833, #3853, #3856): na prévia protegida e sem o segredo de bypass,
  scripts/ci/e2e-alvo.sh devolvia rodar=false, todos os passos seguintes eram pulados e o job terminava com sucesso.
  Regras: job que não roda nunca termina verde; suíte que roda pela metade também não; a prévia roda só @criticos + os
  itens do PR; produção segue no modo público.
  Roda: node --test src/lib/ci/e964-e2e-nunca-verde.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { contarExecutados, contarListados, grepDaPrevia, vereditoCompletude } from "./e2e-completude.ts";

function alvo(env: Record<string, string>): Record<string, string> {
  const out = execFileSync("bash", ["scripts/ci/e2e-alvo.sh"], { env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", ...env }, encoding: "utf8" });
  return Object.fromEntries(out.trim().split("\n").map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
}

test("E964 — prévia sem bypass: rodar=false sai com o motivo numa linha que o passo final lê", () => {
  const r = alvo({ EVENTO: "deployment_status", AMBIENTE: "Preview", TARGET_URL: "https://x.vercel.app", TEM_BYPASS: "false" });
  assert.equal(r.rodar, "false");
  assert.match(r.motivo, /^prévia protegida sem VERCEL_AUTOMATION_BYPASS_SECRET/);
  assert.doesNotMatch(r.motivo, /\n/);
});

test("E964 — quando roda, não há motivo de pulo", () => {
  const r = alvo({ EVENTO: "deployment_status", AMBIENTE: "Preview", TARGET_URL: "https://x.vercel.app", TEM_BYPASS: "true" });
  assert.equal(r.rodar, "true");
  assert.equal(r.motivo, "");
});

// Relatório JSON do Playwright, só com o que a checagem lê.
const t = (status: string, results: string[], skipAnotado = false) => ({
  status,
  annotations: skipAnotado ? [{ type: "skip" }] : [],
  results: results.map((s) => ({ status: s })),
});
const relatorio = (testes: ReturnType<typeof t>[]) => ({ suites: [{ specs: [], suites: [{ specs: testes.map((x, i) => ({ title: `t${i}`, tests: [x] })) }] }] });

test("E964 — listados conta todos os testes do --list (suítes aninhadas)", () => {
  assert.equal(contarListados(relatorio([t("expected", []), t("expected", []), t("expected", [])])), 3);
});

test("E964 — executado: passou, falhou e o pulo de propósito (test.skip) contam; 'não rodou' e interrompido não", () => {
  const r = relatorio([
    t("expected", ["passed"]),
    t("unexpected", ["failed"]),
    t("flaky", ["failed", "passed"]),
    t("skipped", ["skipped"], true), // test.skip(!NO_LABORATORIO): rodou a decisão de pular
    t("skipped", ["skipped"]), // serial depois de falha: não rodou
    t("skipped", ["interrupted"]), // tempo esgotado no meio
    t("skipped", []), // nem começou
  ]);
  assert.equal(contarExecutados(r), 4);
});

test("E964 — executados menor que listados: vermelho com 'E2E INCOMPLETO: X de Y'", () => {
  assert.deepEqual(vereditoCompletude(37, 40), { ok: false, texto: "E2E INCOMPLETO: 37 de 40" });
  assert.deepEqual(vereditoCompletude(0, 40), { ok: false, texto: "E2E INCOMPLETO: 0 de 40" });
});

test("E964 — executados igual a listados: passa; nada listado também não é verde", () => {
  assert.deepEqual(vereditoCompletude(40, 40), { ok: true, texto: "E2E COMPLETO: 40 de 40" });
  assert.equal(vereditoCompletude(0, 0).ok, false);
});

test("E964 — a prévia roda só @criticos + as etiquetas dos itens do PR", () => {
  assert.equal(grepDaPrevia(["E955", "E963"]), "@criticos(?![\\w-])|@(?:E955|E963)(?![0-9])");
  assert.equal(grepDaPrevia([]), "@criticos(?![\\w-])");
  const re = new RegExp(grepDaPrevia(["E95"]));
  assert.ok(re.test("T1 — @E95 algo"));
  assert.ok(!re.test("T1 — @E955 algo"));
  assert.ok(re.test("busca @criticos"));
});

const yml = readFileSync(".github/workflows/e2e.yml", "utf8");
const jobE2e = yml.slice(yml.indexOf("\n  e2e:"), yml.indexOf("\n  prova-ao-vivo:"));

test("E964 — workflow: passo final explícito com if rodar != 'true', 'E2E NÃO RODOU' no resumo e exit 1", () => {
  const i = jobE2e.indexOf("if: steps.alvo.outputs.rodar != 'true'");
  assert.ok(i > 0, "passo final do pulo");
  const passo = jobE2e.slice(i, jobE2e.indexOf("\n      - ", i + 1) > 0 ? jobE2e.indexOf("\n      - ", i + 1) : undefined);
  assert.match(passo, /E2E NÃO RODOU/);
  assert.match(passo, /GITHUB_STEP_SUMMARY/);
  assert.match(passo, /exit 1/);
});

test("E964 — workflow: nenhum passo do job E2E usa continue-on-error; o nome do check diz o que é", () => {
  assert.doesNotMatch(jobE2e, /continue-on-error/);
  assert.match(jobE2e, /name: E2E da prévia/);
});

test("E964 — workflow: a completude roda depois da suíte e o modo público fica registrado", () => {
  assert.match(jobE2e, /e2e-completude\.mjs/);
  assert.match(jobE2e, /--list/);
  assert.match(yml, /modo público: specs logados não rodam em produção/);
});

test("E964 — diagnóstico do bypass: o curl manda só x-vercel-protection-bypass (o set-bypass-cookie responde 307 com Set-Cookie)", () => {
  // 15/11: com o segredo certo a prévia respondeu 307 ao curl e o passo exigia 200 — a Vercel define o cookie
  // "usando um redirecionamento com Set-Cookie". O navegador do Playwright segue o 307; o curl do diagnóstico não.
  const i = jobE2e.indexOf("name: Diagnóstico do bypass da Vercel");
  assert.ok(i > 0, "passo do diagnóstico");
  const passo = jobE2e.slice(i, jobE2e.indexOf("\n      - ", i + 1));
  assert.match(passo, /x-vercel-protection-bypass/);
  assert.doesNotMatch(passo, /-H "x-vercel-set-bypass-cookie/);
});
