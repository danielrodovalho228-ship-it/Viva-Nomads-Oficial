import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { bloqueantes, descreverViolacoes, ROTAS_AXE_PUBLICAS, type ViolacaoAxe } from "./axe-regras.ts";

const v = (id: string, impact: ViolacaoAxe["impact"], alvos = 1): ViolacaoAxe => ({
  id,
  impact,
  help: `ajuda ${id}`,
  nodes: Array.from({ length: alvos }, (_, i) => ({ target: [`#${id}-${i}`] })),
});

test("axe: só crítica e séria bloqueiam; moderada e leve ficam no relatório", () => {
  const lista = [v("a", "critical"), v("b", "serious"), v("c", "moderate"), v("d", "minor"), v("e", null)];
  assert.deepEqual(bloqueantes(lista).map((x) => x.id), ["a", "b"]);
});

test("axe: a descrição não leva HTML da página, só regra, impacto e seletores", () => {
  const texto = descreverViolacoes([v("label", "serious", 2)]);
  assert.match(texto, /label \(serious\)/);
  assert.match(texto, /#label-0/);
  assert.doesNotMatch(texto, /<[a-z]/i);
});

test("axe: sem violação bloqueante a descrição é vazia", () => {
  assert.equal(descreverViolacoes([v("c", "moderate")]), "");
});

test("axe: rotas públicas principais cobertas, sem repetição e todas existem como página", () => {
  assert.equal(new Set(ROTAS_AXE_PUBLICAS).size, ROTAS_AXE_PUBLICAS.length);
  for (const r of ["/", "/buscar", "/como-funciona", "/precos", "/para-proprietarios", "/empresas", "/parceiros", "/ajuda", "/auth"]) {
    assert.ok(ROTAS_AXE_PUBLICAS.includes(r), r);
  }
});

test("axe: a spec t251 usa a regra e o pacote está nas devDependencies", () => {
  assert.ok(existsSync("tests/e2e/specs/t251-acessibilidade-axe.spec.ts"));
  const spec = readFileSync("tests/e2e/specs/t251-acessibilidade-axe.spec.ts", "utf8");
  assert.match(spec, /@axe-core\/playwright/);
  assert.match(spec, /bloqueantes/);
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.ok(pkg.devDependencies["@axe-core/playwright"]);
});
