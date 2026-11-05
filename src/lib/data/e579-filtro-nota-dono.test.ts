/*
  E579 (lab Pista C, t1132, L-97) — o filtro "Emite nota fiscal" (?nota=1, E574) dava SEMPRE 0: o Property da busca não
  leva o ownerId (o dono não vai ao navegador), e o cruzamento com profiles.emite_nota_locacao nunca casava. Agora o dono
  vem das LINHAS do banco (donoPorImovelDasLinhas), só no servidor.
  Roda: node --test src/lib/data/e579-filtro-nota-dono.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FILTROS_PAINEL_VAZIOS, contarFiltrosPainel, passaNoPainel } from "../busca/painel-filtros.ts";

const src = readFileSync(new URL("./properties.ts", import.meta.url), "utf8");

test("a busca passa o dono das linhas para o cruzamento com a declaração", () => {
  assert.match(src, /export function donoPorImovelDasLinhas\(linhas: readonly \{ id: string; owner_id\?: string \| null \}\[\]\): Map<string, string>/);
  assert.match(src, /await attachNotaDono\(mapped, donoPorImovelDasLinhas\(data as unknown as PropertyRow\[\]\)\);/);
  const fn = src.slice(src.indexOf("async function attachNotaDono"));
  assert.match(fn, /const donoDe = \(p: Property\) => donoPorImovel\?\.get\(p\.id\) \?\? p\.ownerId \?\? null;/);
  assert.match(fn, /const reais = list\.filter\(\(p\) => !isExemplo\(p\.id\) && donoDe\(p\)\);/);
  assert.match(fn, /porDono\.get\(donoDe\(p\) as string\)/);
  // O dono continua fora do Property da busca (privacidade): rowToProperty não ganhou ownerId.
  const row = src.slice(src.indexOf("function rowToProperty"), src.indexOf("function rowToProperty") + 4000);
  assert.doesNotMatch(row.slice(0, row.indexOf("\n}\n")), /ownerId:/);
});

test("com o selo calculado, ?nota=1 deixa passar o imóvel do dono declarante (contador ≥ 1)", () => {
  const base = { id: "a", monthlyPrice: 3000, bedrooms: 1, tagHomeOffice: false } as unknown as Parameters<typeof passaNoPainel>[0];
  const filtro = { ...FILTROS_PAINEL_VAZIOS, notaOnly: true };
  const lista = [{ ...base, emiteNotaDono: true }, { ...base, id: "b", emiteNotaDono: false }];
  assert.equal(lista.filter((p) => passaNoPainel(p, filtro)).length, 1);
  assert.equal(contarFiltrosPainel(filtro), contarFiltrosPainel(FILTROS_PAINEL_VAZIOS) + 1);
});
