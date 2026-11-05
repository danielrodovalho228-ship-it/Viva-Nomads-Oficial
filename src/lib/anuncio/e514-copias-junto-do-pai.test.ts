import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { juntarCopiasAoPai } from "./lista-meus-imoveis.ts";

/*
  E514: em Meus imóveis, "N cópias deste rascunho · ver" abria as cópias no FIM da lista (elas são mais antigas e a
  ordem "recentes" as jogava para baixo). As cópias abertas vêm logo depois do cartão-pai, na ordem do grupo.
*/
const ids = (l: { id: string }[]) => l.map((p) => p.id);

test("E514: as cópias abertas vêm logo depois do pai, na ordem do grupo", () => {
  const lista = [{ id: "pai" }, { id: "a" }, { id: "b" }, { id: "c1" }, { id: "x" }, { id: "c2" }];
  const copiasDe = new Map([["pai", ["c1", "c2"]]]);
  assert.deepEqual(ids(juntarCopiasAoPai(lista, copiasDe)), ["pai", "c1", "c2", "a", "b", "x"]);
});

test("E514: dois grupos, cada um junto do seu pai", () => {
  const lista = [{ id: "p1" }, { id: "p2" }, { id: "z" }, { id: "q" }, { id: "w" }];
  const copiasDe = new Map([["p1", ["w"]], ["p2", ["q", "z"]]]);
  assert.deepEqual(ids(juntarCopiasAoPai(lista, copiasDe)), ["p1", "w", "p2", "q", "z"]);
});

test("E514: cópia sem o pai na lista (filtro/busca) fica onde estava; cópia fechada não aparece", () => {
  const lista = [{ id: "a" }, { id: "c1" }, { id: "b" }];
  const copiasDe = new Map([["pai", ["c1", "c2"]]]);
  assert.deepEqual(ids(juntarCopiasAoPai(lista, copiasDe)), ["a", "c1", "b"]);
  // sem grupos, a lista não muda
  assert.deepEqual(ids(juntarCopiasAoPai(lista, new Map())), ["a", "c1", "b"]);
});

test("E514: Meus imóveis junta as cópias ao pai antes de paginar", () => {
  const src = readFileSync("src/app/(dashboard)/dashboard/imoveis/imoveis-client.tsx", "utf8");
  assert.match(src, /juntarCopiasAoPai\(/);
  assert.ok(src.indexOf("juntarCopiasAoPai(") < src.indexOf("paginar(filtrada"), "junta antes de paginar");
});
