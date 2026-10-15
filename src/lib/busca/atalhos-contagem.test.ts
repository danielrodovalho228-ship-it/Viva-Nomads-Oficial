import { test } from "node:test";
import assert from "node:assert/strict";
import { atalhosComContagem, contarAtalho } from "./atalhos-contagem.ts";
import { ATALHOS_CATEGORIA } from "../../config/atalhos-home.ts";

const base = { tagHomeOffice: false, petsAllowed: false, neighborhood: "Centro", city: "Uberlândia" };
const imoveis = [
  { ...base, monthlyPrice: 2000, bedrooms: 1, petsAllowed: true },
  { ...base, monthlyPrice: 2400, bedrooms: 2, tagHomeOffice: true, neighborhood: "Umuarama" },
  { ...base, monthlyPrice: 4000, bedrooms: 3, petsAllowed: true },
];

test("#a875278a: contagem de cada atalho segue as regras da /buscar", () => {
  assert.equal(contarAtalho("/buscar?pet=1", imoveis), 2);
  assert.equal(contarAtalho("/buscar?orcamento=2000", imoveis), 1);
  assert.equal(contarAtalho("/buscar?quartos=3", imoveis), 1);
  assert.equal(contarAtalho("/buscar?homeoffice=1", imoveis), 1);
  assert.equal(contarAtalho("/buscar?local=Umuarama", imoveis), 1);
});

test("#a875278a: atalho com 0 imóveis some e os demais trazem o total real", () => {
  const poucos = [{ ...base, monthlyPrice: 2000, bedrooms: 1 }];
  const vis = atalhosComContagem(ATALHOS_CATEGORIA, poucos);
  assert.deepEqual(vis.map((a) => a.rotulo), ["Até R$ 2.000/mês"]);
  assert.equal(vis[0].total, 1);
  assert.deepEqual(atalhosComContagem(ATALHOS_CATEGORIA, []), []);
});
