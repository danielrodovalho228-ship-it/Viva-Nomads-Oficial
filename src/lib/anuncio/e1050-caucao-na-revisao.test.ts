/*
  E1050 — trava: a etapa "Revise e publique" mostra ao dono o valor calculado da caução (50% do mensal). Antes, nem o
  passo de Preço nem a revisão mostravam o valor — só a preferência de garantia.
  Roda: node --test src/lib/anuncio/e1050-caucao-na-revisao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { caucaoDaPrevia, ROTULO_CAUCAO_PREVIA } from "./passo10-colunas.ts";
import type { Property } from "../types.ts";

const revisar = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx", import.meta.url), "utf8");
const imovel = (monthlyPrice: number | undefined) => ({ monthlyPrice } as unknown as Property);

test("E1050 — a caução é 50% do valor mensal", () => {
  assert.equal(caucaoDaPrevia(imovel(4000)), 2000);
  assert.equal(caucaoDaPrevia(imovel(3333)), 1666.5);
});

test("E1050 — sem valor mensal não há caução (nada de R$ 0)", () => {
  assert.equal(caucaoDaPrevia(imovel(0)), null);
  assert.equal(caucaoDaPrevia(imovel(undefined)), null);
});

test("E1050 — o rótulo diz de onde sai o número", () => {
  assert.equal(ROTULO_CAUCAO_PREVIA, "Caução (50% do mensal)");
});

test("E1050 — a prévia da revisão mostra a linha da caução, com o valor formatado", () => {
  assert.match(revisar, /caucaoDaPrevia\(p\.previewProperty\)/);
  assert.match(revisar, /data-testid="previa-preco-caucao"/);
  assert.match(revisar, /\{ROTULO_CAUCAO_PREVIA\}/);
  assert.match(revisar, /formatBRL\(caucao\)/);
});
