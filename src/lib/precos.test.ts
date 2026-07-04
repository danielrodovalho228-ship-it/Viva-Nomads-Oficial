/*
  Testes da fonte única do preço "tudo incluído" (corrige a divergência do E2E).
  Roda com: node --experimental-strip-types --test src/lib/precos.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { calcularTudoIncluido, totalPeriodo } from "./precos.ts";

// Objeto mínimo compatível com o que a função usa (evita depender do tipo cheio).
function imovel(over: Record<string, unknown>) {
  return {
    monthlyPrice: 3000,
    condoFee: 0,
    utilitiesMode: "fixed",
    utilitiesEstimate: 0,
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

test("tudo incluído = aluguel + condomínio + consumo fixo", () => {
  const r = calcularTudoIncluido(imovel({ monthlyPrice: 3000, condoFee: 480, utilitiesEstimate: 480 }));
  assert.equal(r.total, 3960); // 3000 + 480 + 480
  assert.equal(r.condominio, 480);
  assert.equal(r.consumoFixo, 480);
  assert.equal(r.temExtras, true);
});

test("regime medido: consumo não entra no número exibido", () => {
  const r = calcularTudoIncluido(imovel({ utilitiesMode: "medido", utilitiesEstimate: 999, condoFee: 200 }));
  assert.equal(r.consumoFixo, 0);
  assert.equal(r.total, 3200); // 3000 + 200 (condomínio) + 0
});

test("sem extras: total = aluguel e temExtras = false", () => {
  const r = calcularTudoIncluido(imovel({ condoFee: 0, utilitiesEstimate: 0 }));
  assert.equal(r.total, 3000);
  assert.equal(r.temExtras, false);
});

test("total do período = tudo incluído × meses", () => {
  const im = imovel({ monthlyPrice: 3000, condoFee: 480, utilitiesEstimate: 480 });
  assert.equal(totalPeriodo(im, 4), 15840); // 3960 × 4
});
