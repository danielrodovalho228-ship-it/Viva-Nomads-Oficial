/*
  /dashboard/simulador (ordem 75553f0a): regra única de comissão (faixas 12/10/8/6% sobre o valor total de cada
  contrato), sem planos nem assinatura. Roda: node --test src/config/simulador-painel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PAGINA = readFileSync("src/app/(dashboard)/dashboard/simulador/page.tsx", "utf8");

test("simulador do painel não usa planos, assinatura nem comparador de planos", () => {
  assert.doesNotMatch(PAGINA, /PlanoPills|Simular no plano|assinaturaAnual|sob consulta|@\/config\/planos|compararPlanos|recomendarPlano/i);
  assert.doesNotMatch(PAGINA, /Gratuito|Essencial|Profissional|mensalidade|Piloto Fundador|plano-recomendado/);
});

test("simulador do painel usa as faixas da regra única e o nº de imóveis ativos", () => {
  assert.match(PAGINA, /faixaPorImoveisAtivos/);
  assert.match(PAGINA, /taxaPublicaTexto|pctTexto/);
  assert.match(PAGINA, /data-testid="imoveis-ativos"/);
});

test("spec t12 testa a taxa por faixa, não a recomendação de plano antiga", () => {
  const spec = readFileSync("tests/e2e/specs/t12-planos.spec.ts", "utf8");
  assert.doesNotMatch(spec, /plano-recomendado|Recomendado para você:/);
  assert.match(spec, /taxa-faixa/);
  assert.match(spec, /imoveis-ativos/);
});
