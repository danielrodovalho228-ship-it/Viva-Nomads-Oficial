/* E729 — a exigência do portfólio (fotografia) aparece junto da categoria, antes de marcar. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NOTA_PORTFOLIO_CATEGORIA, CATEGORIAS_CATALOGO } from "./regras.ts";

const form = readFileSync("src/components/parceiros/seja-parceiro-form.tsx", "utf8");
test("só fotografia carrega a nota do portfólio, e ela é de uma categoria que existe no formulário", () => {
  assert.deepEqual(Object.keys(NOTA_PORTFOLIO_CATEGORIA), ["fotografia"]);
  assert.ok(CATEGORIAS_CATALOGO.some((c) => c.valor === "fotografia"));
  assert.match(NOTA_PORTFOLIO_CATEGORIA.fotografia, /portfólio/);
});
test("o formulário mostra a nota nos dois desenhos de categoria (cartão com foto e caixa simples)", () => {
  assert.equal((form.match(/NOTA_PORTFOLIO_CATEGORIA\[k\.valor\]/g) ?? []).length >= 4, true);
  assert.match(form, /data-testid=\{`sp-cat-nota-\$\{k\.valor\}`\}/);
  assert.match(form, /obrigatório para fotografia/); // o rótulo do campo continua
});
