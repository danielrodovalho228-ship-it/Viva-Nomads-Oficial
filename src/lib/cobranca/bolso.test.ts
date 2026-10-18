import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularBolso, NOTA_BOLSO } from "./bolso.ts";
import { comissaoSobreContrato } from "./regra.ts";

// Ordem 6696611c: cada faixa usa comissaoSobreContrato (3.000 × 6 = 18.000).
const FAIXAS: [number, number, string][] = [
  [1, 0.12, "12%"],
  [2, 0.12, "12%"],
  [3, 0.1, "10%"],
  [5, 0.1, "10%"],
  [6, 0.08, "8%"],
  [15, 0.08, "8%"],
  [16, 0.06, "6%"],
  [30, 0.06, "6%"],
];

for (const [imoveis, taxa, texto] of FAIXAS) {
  test(`${imoveis} imóvel(is): taxa ${texto} sobre o total do contrato`, () => {
    const b = calcularBolso(3000, 6, imoveis);
    assert.equal(b.estado, "ok");
    if (b.estado !== "ok") return;
    assert.equal(b.recebe, 18000);
    assert.equal(b.taxa, taxa);
    assert.equal(b.taxaTexto, texto);
    assert.equal(b.valorTaxa, comissaoSobreContrato(3000, 6, taxa));
    assert.equal(b.fica, 18000 - b.valorTaxa);
  });
}

test("31+ imóveis é Plano Gestor: sem valor de taxa", () => {
  for (const n of [31, 80]) {
    const b = calcularBolso(3000, 6, n);
    assert.deepEqual(b, { estado: "gestor", recebe: 18000 });
  }
});

test("entrada inválida não calcula", () => {
  for (const [v, m, i] of [[0, 6, 1], [-1, 6, 1], [NaN, 6, 1], [3000, 0, 1], [3000, NaN, 1], [3000, 6, 0], [3000, 6, NaN]]) {
    assert.deepEqual(calcularBolso(v, m, i), { estado: "invalido" });
  }
});

test("meses fracionados valem o inteiro abaixo; centavos preservados", () => {
  const b = calcularBolso(2500.5, 3.9, 1);
  assert.equal(b.estado, "ok");
  if (b.estado === "ok") assert.equal(b.recebe, 7501.5);
});

test("a nota pública não usa termos proibidos", () => {
  assert.match(NOTA_BOLSO, /Anúncio grátis/);
  assert.doesNotMatch(NOTA_BOLSO, /comiss|corretagem|intermedia|aluguel/i);
});
