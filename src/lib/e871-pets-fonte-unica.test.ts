/*
  E871 (Phoenix RELATORIO-020, A-94; família E776): o filtro "Aceita pets" lê a FLAG do anúncio (petsAllowed) e a página do
  ube-003 dizia "Aceita pets" em "Tem" porque o rótulo estava solto na LISTA DE COMODIDADES — duas fontes para o mesmo fato:
  ube-003 ficava fora do filtro com "Aceita pets" na página. Regra: pets tem UMA fonte, a flag (o filtro, a linha das regras da
  casa e o selo leem dela); nenhuma lista de comodidades carrega pets; todo exemplo tem a flag definida.
  Roda: node --test src/lib/e871-pets-fonte-unica.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { SAMPLE_PROPERTIES } from "./properties.ts";

test("nenhum exemplo carrega pets na lista de comodidades (a fonte é a flag)", () => {
  const comPetNaLista = SAMPLE_PROPERTIES.filter((p) => (p.amenities ?? []).some((a) => /\bpets?\b/i.test(a))).map((p) => p.id);
  assert.deepEqual(comPetNaLista, []);
});

test("todo exemplo tem a flag de pets definida (nunca 'indefinido = não')", () => {
  const semFlag = SAMPLE_PROPERTIES.filter((p) => typeof p.petsAllowed !== "boolean").map((p) => p.id);
  assert.deepEqual(semFlag, []);
});

test("ube-003: a página dizia 'Aceita pets' — o filtro passa a contar com ele (a mesma fonte)", () => {
  assert.equal(SAMPLE_PROPERTIES.find((p) => p.id === "ube-003")!.petsAllowed, true);
});
