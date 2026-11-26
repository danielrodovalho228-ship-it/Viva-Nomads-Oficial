/*
  E1225 (ORDENS-DUET 1120 e 1127) — as linhas da caução POR BLOCO na tela do dono (/dashboard/contratos). PURO.
  Cada bloco com caução tem a sua linha: o registro dele, ou o que falta nele. O que falta no bloco k é a parte da
  caução do bloco que o teto ACUMULADO ainda deixa em aberto: min(caução do bloco k, a soma das cauções dos blocos 1..k −
  a caução já registrada e ativa). O botão só aparece no 1.º bloco com algo em aberto (por ordem) — consequência literal
  do teto acumulado: registrar o 2.º antes do 1.º deixaria o 1.º com 0 em aberto.
  Roda: node --test src/lib/caucao-linhas-por-bloco.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import * as teto from "./caucao-teto.ts";

type Linha = { id: string; numero: number; caucao: number; registro: { id: string; valor: number; confirmado: boolean } | null; emAberto: number; oferecer: boolean };
const linhas = (teto as unknown as { linhasDaCaucaoPorBloco?: (b: { id: string; numero: number; caucao: number }[], p: { id: string; blocoId: string | null; tipo: string; valor: number; confirmado: boolean }[]) => Linha[] }).linhasDaCaucaoPorBloco;

const DOIS = [{ id: "b2", numero: 2, caucao: 3750 }, { id: "b1", numero: 1, caucao: 3750 }];
const cau = (id: string, blocoId: string | null, valor: number, confirmado = false) => ({ id, blocoId, tipo: "caucao", valor, confirmado });
const resumo = (ls: Linha[]) => ls.map((l) => [l.numero, l.registro?.id ?? null, l.emAberto, l.oferecer]);

test("existe e ordena por bloco", () => {
  assert.equal(typeof linhas, "function", "caucao-teto exporta linhasDaCaucaoPorBloco");
  assert.deepEqual(linhas!(DOIS, []).map((l) => l.numero), [1, 2]);
});

test("1. R$ 7.500 registrados no contrato (2 × 3.750) → nada a registrar nos dois blocos, sem botão", () => {
  assert.deepEqual(resumo(linhas!(DOIS, [cau("antiga", null, 7500)])), [[1, null, 0, false], [2, null, 0, false]]);
});

test("2. R$ 3.750 registrados no contrato → o 2.º bloco tem R$ 3.750 em aberto, e é ele que oferece o botão", () => {
  assert.deepEqual(resumo(linhas!(DOIS, [cau("antiga", null, 3750)])), [[1, null, 0, false], [2, null, 3750, true]]);
});

test("3. nada registrado → cada bloco tem a sua caução em aberto; só o 1.º oferece o botão", () => {
  assert.deepEqual(resumo(linhas!(DOIS, [])), [[1, null, 3750, true], [2, null, 3750, false]]);
});

test("4. a do bloco 1 registrada no bloco → a linha do bloco 1 mostra o registro; o 2.º oferece", () => {
  const ls = linhas!(DOIS, [cau("c1", "b1", 3750, true)]);
  assert.deepEqual(resumo(ls), [[1, "c1", 0, false], [2, null, 3750, true]]);
  assert.equal(ls[0].registro?.confirmado, true);
});

test("5. um registro antigo menor deixa a diferença no 1.º bloco", () => {
  assert.deepEqual(resumo(linhas!(DOIS, [cau("antiga", null, 1000)])), [[1, null, 2750, true], [2, null, 3750, false]]);
});

test("6. bloco sem caução fica fora; aluguel não conta", () => {
  const ls = linhas!([{ id: "b1", numero: 1, caucao: 1500 }, { id: "b2", numero: 2, caucao: 0 }], [{ id: "a1", blocoId: "b1", tipo: "aluguel", valor: 6000, confirmado: true }]);
  assert.deepEqual(resumo(ls), [[1, null, 1500, true]]);
});
