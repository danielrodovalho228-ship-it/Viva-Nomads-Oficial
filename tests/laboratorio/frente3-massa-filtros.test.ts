// Frente 3 (busca): desde o E131 (60a7fba69) os exemplos saem das contagens quando há anúncio real, e a massa do
// laboratório não tinha anúncio real com pet, 3+ quartos, preço até R$ 2.500, Umuarama, garagem nem máquina de lavar.
// t66/t71/t78 passam a criar esse anúncio (fixtures/massa-filtros-busca.ts). Esta guarda impede que a massa saia ou
// perca um dos atributos que os atalhos e chips leem.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ATALHOS_CATEGORIA } from "../../src/config/atalhos-home.ts";

const massa = readFileSync("tests/e2e/fixtures/massa-filtros-busca.ts", "utf8");

test("a massa cobre cada atalho da home e os dois chips de comodidade", () => {
  for (const a of ATALHOS_CATEGORIA) {
    const cobre: Record<string, RegExp> = {
      "/buscar?preco=2500": /preco: 2200/,
      "/buscar?pet=1": /pets_allowed: true/,
      "/buscar?homeoffice=1": /tag_home_office: true/,
      "/buscar?quartos=3": /bedrooms: 3/,
      "/buscar?local=Umuarama": /address: "Umuarama"/,
      "/buscar?comod=garagem": /label: "Vaga de garagem"/,
    };
    assert.ok(cobre[a.href], `atalho novo sem massa: ${a.href}`);
    assert.match(massa, cobre[a.href], a.rotulo);
  }
  assert.match(massa, /label: "Máquina de lavar"/);
  assert.ok(massa.indexOf('status: "active"') > massa.indexOf("property_amenities"), "publica por último");
});

test("t66, t71 e t78 criam e apagam a massa", () => {
  for (const f of ["t66-home-busca-principal", "t71-busca-topo", "t78-filtros-estadia-longa"]) {
    const s = readFileSync(`tests/e2e/specs/${f}.spec.ts`, "utf8");
    assert.match(s, /criarMassaFiltrosBusca\(/, f);
    assert.match(s, /apagarMassaFiltrosBusca\(massaFiltros\)/, f);
  }
});
