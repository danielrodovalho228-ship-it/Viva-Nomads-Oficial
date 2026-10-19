/*
  /dashboard/roi-imovel (ordem bd296d53, item 3): regra única, comparação justa e retorno do Airbnb sem
  promessa inflada. Roda: node --test src/config/roi-imovel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RETORNO_AIRBNB_UBERLANDIA } from "./compare-precos.ts";

const PAGINA = readFileSync("src/app/(dashboard)/dashboard/roi-imovel/page.tsx", "utf8");

test("roi-imovel não usa planos nem assinatura", () => {
  assert.doesNotMatch(PAGINA, /PlanoPills|Simular no plano|assinaturaAnual|sob consulta|@\/config\/planos/);
  assert.doesNotMatch(PAGINA, /Gratuito|Essencial|Profissional|mensalidade|vistoria|30 a 180/);
});

test("roi-imovel usa as faixas da regra única e mostra o comparativo com fontes e data", () => {
  assert.match(PAGINA, /faixaPorImoveisAtivos/);
  // Prompt 27: o comparativo da Calculadora é Viva, Airbnb (com fonte) e o tradicional — sem QuintoAndar.
  assert.match(PAGINA, /canaisDaCalculadora\(/);
  assert.match(PAGINA, /COMPARE_RODAPE/);
});

test("retorno do Airbnb em Uberlândia: 0,6% bruto e 0,1–0,4% líquido, sem '1–2% ao mês'", () => {
  assert.equal(RETORNO_AIRBNB_UBERLANDIA.brutoMensalPct, 0.6);
  assert.equal(RETORNO_AIRBNB_UBERLANDIA.liquidoMensalMinPct, 0.1);
  assert.equal(RETORNO_AIRBNB_UBERLANDIA.liquidoMensalMaxPct, 0.4);
  assert.doesNotMatch(RETORNO_AIRBNB_UBERLANDIA.texto, /1\s*[–-]\s*2\s*%/);
  assert.match(RETORNO_AIRBNB_UBERLANDIA.texto, /out\/2026/);
});
