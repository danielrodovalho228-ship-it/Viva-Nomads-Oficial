import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Regressão t64 (ordem bbced3fa): o bloqueio por plano não pode estreitar a tela.
// Conta sem plano Gestor abria /dashboard/carteira com 576 px contra 960 px da Visão geral.
const fonte = readFileSync("src/components/dashboard/plan-gate.tsx", "utf8");
const bloqueado = fonte.slice(fonte.indexOf("const minLabel"));

test("PlanGate bloqueado ocupa a largura cheia (sem max-w no contêiner da página)", () => {
  assert.doesNotMatch(bloqueado, /<div className="[^"]*max-w-[^"]*">\s*<PageTitle/);
});

test("PlanGate bloqueado mantém o texto centralizado dentro do painel", () => {
  assert.match(bloqueado, /<Panel className="text-center">/);
});

// Ordem 90181c57 (#93): "Ver planos" e o cartão bloqueado levam a /precos, não a /dashboard/assinatura.
test("PlanGate bloqueado leva a /precos", () => {
  assert.match(bloqueado, /href="\/precos"/);
  assert.doesNotMatch(bloqueado, /\/dashboard\/assinatura/);
});

test("Ferramentas bloqueadas por plano levam a /precos", () => {
  const f = readFileSync("src/app/(dashboard)/dashboard/ferramentas/page.tsx", "utf8");
  assert.match(f, /bloqueado \? "\/precos"/);
  assert.doesNotMatch(f, /\/dashboard\/assinatura/);
});
