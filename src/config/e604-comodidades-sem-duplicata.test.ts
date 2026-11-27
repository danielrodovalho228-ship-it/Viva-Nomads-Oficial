/*
  E604: "Lava-louças" e "TV" apareciam em "Conforto do imóvel" (comodidades do Passo 5) E de novo no bloco "Extras" do
  nível — a mesma característica podia ser declarada em dois lugares. Agora cada característica mora num lugar só: as
  comodidades. Os Extras deixam de oferecê-las; as duas chaves seguem válidas como LEGADO (há declarações gravadas),
  então a ficha continua mostrando o que já foi salvo e o "Salvar extras" não apaga.
  Roda: node --test src/config/e604-comodidades-sem-duplicata.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { AMENITY_GROUPS } from "../lib/amenities.ts";
import { EXTRAS, EXTRAS_LEGADOS, ehChaveExtra } from "./niveis.ts";
import { textoExtras } from "../lib/niveis/exibicao.ts";
import { validarExtras } from "../lib/niveis/regras.ts";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const comodidades = AMENITY_GROUPS.flatMap((g) => g.items);

test("E604: nenhum extra oferecido repete uma comodidade (nem pela chave, nem pelo nome)", () => {
  const chaves = new Set(comodidades.map((i) => i.key));
  const nomes = new Set(comodidades.map((i) => norm(i.label)));
  for (const e of EXTRAS) {
    assert.ok(!chaves.has(e.chave), `extra "${e.chave}" já é comodidade`);
    assert.ok(!nomes.has(norm(e.rotulo)), `extra "${e.rotulo}" repete o nome de uma comodidade`);
  }
});

test("E604: Lava-louças e TV ficam só nas comodidades (Conforto do imóvel)", () => {
  const conforto = AMENITY_GROUPS.find((g) => g.category === "conforto");
  assert.ok(conforto?.items.some((i) => i.key === "lava_loucas"));
  assert.ok(conforto?.items.some((i) => i.key === "tv"));
  assert.ok(!EXTRAS.some((e) => (e.chave as string) === "lava_loucas" || (e.chave as string) === "tv"));
});

test("E604: o que já foi salvo como extra segue valendo (legado) — a ficha mostra e o salvar não apaga", () => {
  assert.deepEqual(EXTRAS_LEGADOS.map((e) => e.chave).sort(), ["lava_loucas", "tv"]);
  assert.ok(ehChaveExtra("tv") && ehChaveExtra("lava_loucas"));
  assert.deepEqual(validarExtras(["tv", "air_fryer", "inventado"]).sort(), ["air_fryer", "tv"]);
  assert.equal(textoExtras(["air_fryer", "lava_loucas"]), "Air fryer, Lava-louças");
});
