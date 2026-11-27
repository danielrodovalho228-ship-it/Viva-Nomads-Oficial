/*
  E604 (Gerente, 16/11) — extra antigo que duplica uma comodidade é defeito: nenhum item nas duas listas. A correção é
  na EXIBIÇÃO (a comodidade vence), sem mexer nos dados do dono: um anúncio com "TV" nas comodidades e o extra legado
  "tv" salvo mostra TV só nas comodidades. Fixture do laboratório (scripts/lab/seed-lab.mjs) para a t2051 exercitar.
  Roda: node --test src/lib/niveis/e604-extra-nao-repete-comodidade.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { textoExtras } from "./exibicao.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("E604 — o extra legado que repete uma comodidade do anúncio não aparece nos Extras (pelo nome ou pela chave)", () => {
  assert.equal(textoExtras(["tv", "air_fryer"], ["TV", "Wi-Fi"]), "Air fryer");
  assert.equal(textoExtras(["lava_loucas"], ["Lava-louças"]), null);
  assert.equal(textoExtras(["lava_loucas"], ["lava_loucas"]), null);
});

test("E604 — sem a comodidade no anúncio, o extra salvo continua aparecendo (os dados do dono não mudam)", () => {
  assert.equal(textoExtras(["tv", "air_fryer"], ["Wi-Fi"]), "Air fryer, TV");
  assert.equal(textoExtras(["tv"]), "TV");
});

test("E604 — a ficha passa as comodidades do anúncio ao bloco do nível; o laboratório tem o caso duplicado", () => {
  assert.match(ler("src/app/(public)/imoveis/[id]/property-detail.tsx"), /<NivelImovel dados=\{exibicao59\?\.nivel\} comodidades=\{property\.amenities\} \/>/);
  assert.match(ler("src/components/niveis/nivel-imovel.tsx"), /textoExtras\(dados\.extras, comodidades\)/);
  const seed = ler("scripts/lab/seed-lab.mjs");
  assert.match(seed, /E604/);
  assert.match(seed, /imovel_extras[\s\S]{0,200}chave: "tv"/);
  assert.match(seed, /property_amenities[\s\S]{0,200}label: "TV"/);
});
