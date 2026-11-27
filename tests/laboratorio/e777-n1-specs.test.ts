import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E744 (decisão do chat principal, E777): com 1 mês o total do período também é "R$ Y em 1 mês"; t262/t703 acompanham.
const ler = (f: string) => readFileSync(f, "utf8");
test("t262 espera o total em 1 mês na barra e no cartão lateral", () => {
  const s = ler("tests/e2e/specs/t262-detalhe-imovel-41.spec.ts");
  assert.match(s, /em 1 mês\/\)/);
  assert.doesNotMatch(s, /await expect\(estadia\)\.toHaveCount\(0\)/);
});
test("t703 espera a linha 'Estadia mínima (1 mês)'", () => {
  assert.match(ler("tests/e2e/specs/t703-e254-estadia-minima.spec.ts"), /Estadia mínima \\\(1 mês\\\)\/\)\)\.toHaveCount\(1\)/);
});
test("t132 lê o aviso do anúncio de exemplo pelo texto atual", () => {
  assert.match(ler("tests/e2e/specs/t132-solicitar-reserva.spec.ts"), /anúncio é de exemplo/);
  assert.match(ler("src/app/(public)/imoveis/[id]/property-detail.tsx"), /Este anúncio é de exemplo/);
});
