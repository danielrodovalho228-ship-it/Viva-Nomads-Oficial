/*
  Assinatura honesta: plano REAL na tela, seletor de demonstração só no modo demo,
  e "Quero este plano" (sem erro cru) enquanto a cobrança não está ligada.
  Roda: node --test src/lib/assinatura-honesta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("tela: plano atual vem do servidor; nada de 'Gratuito' fixo", () => {
  const t = ler("app/(dashboard)/dashboard/assinatura/page.tsx");
  assert.doesNotMatch(t, /const currentPlanId = "free";/);
  assert.match(t, /const currentPlanId = minha\?\.plano \?\? "free";/);
  assert.doesNotMatch(t, /<p className="font-title text-xl font-bold text-ink">Gratuito<\/p>/);
  assert.doesNotMatch(t, /1 anúncio ativo · sem cobrança/);
});

test("tela: seletor de demonstração só no modo demonstração", () => {
  const t = ler("app/(dashboard)/dashboard/assinatura/page.tsx");
  assert.ok(t.indexOf("{demoOn && (") > 0 && t.indexOf("{demoOn && (") < t.indexOf("Visualizar como plano (demonstração)"));
});

test("cobrança desligada: aviso honesto e 'Quero este plano' no lugar do erro cru", () => {
  const t = ler("app/(dashboard)/dashboard/assinatura/page.tsx");
  assert.match(t, /minha && !minha\.pagamentosAtivos && \(/);
  assert.match(t, /As assinaturas pagas abrem no lançamento\./);
  assert.match(t, /Quero este plano/);
  assert.match(t, /disabled=\{current \|\| plan\.price === 0 \|\| \(!!minha && !minha\.temDocumento\)\}/);
  const a = ler("lib/data/planos-actions.ts");
  assert.match(a, /pagamentosAtivos: isAsaasConfigured\(\) \|\| !emProducao\(\),/);
  assert.match(a, /plano: plano as MinhaAssinatura\["plano"\]/);
});
