/*
  E951 — TRAVA ESTÁTICA do @ao-vivo-seguro. Nenhum spec roda em produção sem passar por aqui:
  todo spec de tests/e2e/specs/ com a etiqueta @ao-vivo-seguro (1) não pode chamar pagamento, assinatura, envio externo,
  escrita pela chave de serviço nem depender do laboratório; (2) leva a etiqueta do item (@E<n>) que prova.
  Roda: node --test src/lib/ci/e951-ao-vivo-seguro.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { ETIQUETA_SEGURA, etiquetasDoSpec, motivosInseguros } from "./prova-ao-vivo.ts";

const PASTA = new URL("../../../tests/e2e/specs/", import.meta.url);
const SPECS = readdirSync(PASTA).filter((f) => f.endsWith(".spec.ts"));
const fonte = (f: string) => readFileSync(new URL(f, PASTA), "utf8");

test("todo spec @ao-vivo-seguro só lê ou escreve com conta de teste: nada de pagamento, assinatura, envio externo ou lab", () => {
  const ruins: string[] = [];
  for (const f of SPECS) {
    const src = fonte(f);
    if (!etiquetasDoSpec(src).includes(ETIQUETA_SEGURA)) continue;
    for (const m of motivosInseguros(src)) ruins.push(`${f}: ${m.motivo}`);
  }
  assert.deepEqual(ruins, []);
});

test("todo spec @ao-vivo-seguro diz o item que prova (@E<n>)", () => {
  const semItem = SPECS.filter((f) => {
    const e = etiquetasDoSpec(fonte(f));
    return e.includes(ETIQUETA_SEGURA) && !e.some((t) => /^@E\d+$/.test(t));
  });
  assert.deepEqual(semItem, []);
});

test("a trava pega cada fluxo proibido (fixtures) e deixa passar o spec que só lê", () => {
  const casos: [string, string][] = [
    ["pagamento", `await page.request.post("/api/pagamentos/pix", {});`],
    ["pagamento", `await page.getByRole("button", { name: /Pagar agora/ }).click();`],
    ["assinatura", `await page.goto("/api/assinatura/zapsign");`],
    ["assinatura", `await tornarContratoVigente(id, dono);`],
    ["envio-externo", `await page.getByRole("button", { name: /Enviar mensagem/ }).click();`],
    ["envio-externo", `await page.request.post("/api/mensagens", { data });`],
    ["escrita-por-fora", `await adm().from("properties").insert({});`],
    ["so-laboratorio", `test.skip(!NO_LABORATORIO, "só no lab");`],
    ["login", `test.use({ storageState: authFile("inquilino") });`],
    ["formulario-publico", `await page.request.post("/api/leads", { data });`],
  ];
  for (const [id, codigo] of casos) assert.ok(motivosInseguros(codigo).some((m) => m.id === id), `${id}: ${codigo}`);
  const leitura = `test("a página mostra o prazo", { tag: ["@E948", "@ao-vivo-seguro"] }, async ({ page }) => {
    await page.goto("/para-proprietarios");
    await expect(page.getByTestId("pp-prazo-documento")).toContainText("2 dias úteis");
  });`;
  assert.deepEqual(motivosInseguros(leitura), []);
  // Sessão vazia explícita é visitante (t1625): não é login.
  assert.deepEqual(motivosInseguros(`test.use({ storageState: { cookies: [], origins: [] } });\nawait page.goto("/buscar");`), []);
  // Comentário não é código: citar o fluxo proibido num comentário não trava.
  assert.deepEqual(motivosInseguros(`// não chama /api/pagamentos nem o ZapSign\n/* resend */\nawait page.goto("/");`), []);
});
