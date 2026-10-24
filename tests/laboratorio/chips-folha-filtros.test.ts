import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Os chips da folha de filtros mostram "rótulo · N" (FILTROS-1). O texto exato não casa mais:
// os specs clicam pelo papel "button" com o nome acessível (o N é aria-hidden).
const SPECS = [
  "t222-pets-filtro-porte",
  "t67-busca-celular",
  "t71-busca-topo",
  "t284-busca-internet-medida",
  "t285-busca-datas-flexiveis",
];

for (const spec of SPECS) {
  test(`${spec}: chip da folha de filtros clicado pelo papel, não por getByText exato`, () => {
    const fonte = readFileSync(`tests/e2e/specs/${spec}.spec.ts`, "utf8");
    const ruim = fonte.split("\n").filter((l) => /(painel|folha)[^;]*\.getByText\("[^"]+", \{ exact: true \}\)\.click/.test(l));
    assert.deepEqual(ruim, []);
  });
}
