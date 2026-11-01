/*
  Selo "Preço justo" nos anúncios de exemplo (ordem 3185f08d): mesmo critério dos reais, nunca forçado.
  Roda: node --test src/lib/preco-justo-exemplo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { temSeloPrecoJusto } from "./preco-justo.ts";
import { SAMPLE_PROPERTIES } from "./properties.ts";
import { calcularTudoIncluido } from "./precos.ts";

const fonte = readFileSync(new URL("./properties.ts", import.meta.url), "utf8");
const exemplos = fonte.split(/\n  \{\n    id: "/).slice(1).map((b) => ({
  id: b.slice(0, b.indexOf('"')),
  mensal: Number(b.match(/\n    monthlyPrice: (\d+)/)?.[1]),
  airbnb: b.match(/\n    airbnbMonthlyPrice: (\d+)/)?.[1],
}));

test("ube-001 tem valor do Airbnb: o selo sai do critério, pelo TOTAL por mês (E399-B)", () => {
  const e = exemplos.find((x) => x.id === "ube-001");
  assert.ok(e && e.airbnb, "ube-001 precisa de airbnbMonthlyPrice");
  const p = SAMPLE_PROPERTIES.find((x) => x.id === "ube-001")!;
  assert.equal(p.precoJusto, temSeloPrecoJusto(calcularTudoIncluido(p).total, Number(e.airbnb)));
});

test("os outros exemplos não têm Airbnb → sem selo; Airbnb ≤ mensal → sem selo", () => {
  for (const e of exemplos.filter((x) => x.id !== "ube-001")) {
    assert.equal(e.airbnb, undefined, `${e.id} não deve ter Airbnb`);
    assert.equal(temSeloPrecoJusto(e.mensal, undefined), false);
  }
  assert.equal(temSeloPrecoJusto(3200, 3200), true); // E399-B: "não maior"
  assert.equal(temSeloPrecoJusto(3200, 3000), false);
});

test("o selo dos exemplos é calculado pelo critério, não fixo no código", () => {
  assert.match(fonte, /p\.precoJusto = temSeloPrecoJusto\(calcularTudoIncluido\(p\)\.total, p\.airbnbMonthlyPrice\)/);
  assert.doesNotMatch(fonte, /precoJusto: true/);
});
