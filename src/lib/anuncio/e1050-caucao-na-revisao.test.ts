/*
  E1050 — trava: a etapa "Revise e publique" mostra ao dono o valor calculado da caução. Antes, nem o passo de Preço
  nem a revisão mostravam o valor — só a preferência de garantia.
  E1061 (lei do produto, Daniel, 20/11/2026: a caução é a do contrato): o cadastro dizia "50% do mensal" para qualquer
  anúncio, e a página do mesmo anúncio dizia a caução do 1º bloco da estadia mínima (com mínimo de 90 dias, R$ 4.500
  contra R$ 1.500). As asserções do valor e do rótulo mudam por essa decisão: o cadastro passa a cobrar o mesmo número
  e o mesmo rótulo da página do imóvel (caucaoDoPrimeiroBloco).
  Roda: node --test src/lib/anuncio/e1050-caucao-na-revisao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { caucaoDaPrevia } from "./passo10-colunas.ts";
import { linhasDeTaxas } from "../reserva-imovel.ts";
import { formatBRL } from "../utils.ts";
import type { Property } from "../types.ts";

const revisar = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx", import.meta.url), "utf8");
const imovel = (monthlyPrice: number | undefined, minPeriodDays = 30) => ({ monthlyPrice, minPeriodDays } as unknown as Property);

test("E1050 + E1061 — com estadia mínima de 30 dias, a caução é 50% do valor mensal", () => {
  assert.equal(caucaoDaPrevia(imovel(4000))?.valor, 2000);
  // O contrato arredonda a caução do bloco ao real: R$ 1.667 (antes o cadastro guardava R$ 1.666,50 e mostrava o mesmo R$ 1.667).
  assert.equal(caucaoDaPrevia(imovel(3333))?.valor, 1667);
});

test("E1061 — o cadastro diz o MESMO número e o MESMO rótulo da página do imóvel, para qualquer estadia mínima", () => {
  for (const min of [30, 45, 60, 90, 120, 180]) for (const mensal of [2500, 3000, 4333.33]) {
    const naPagina = linhasDeTaxas({ monthlyPrice: mensal, minPeriodDays: min }).find((l) => l.chave === "caucao")!;
    const noCadastro = caucaoDaPrevia(imovel(mensal, min))!;
    assert.equal(formatBRL(noCadastro.valor), naPagina.valor, `${min} dias a ${mensal}`);
    assert.equal(noCadastro.rotulo, naPagina.rotulo, `${min} dias a ${mensal}`);
  }
  // O caso que divergia: mínimo de 90 dias a R$ 3.000 — a página dizia R$ 4.500 e o cadastro R$ 1.500.
  assert.equal(caucaoDaPrevia(imovel(3000, 90))?.valor, 4500);
});

test("E1050 — sem valor mensal não há caução (nada de R$ 0)", () => {
  assert.equal(caucaoDaPrevia(imovel(0)), null);
  assert.equal(caucaoDaPrevia(imovel(undefined)), null);
});

test("E1050 + E1061 — o rótulo diz de onde sai o número: o 1º bloco da estadia mínima", () => {
  assert.equal(caucaoDaPrevia(imovel(4000))?.rotulo, "Caução do 1º bloco (1 mês)");
  assert.equal(caucaoDaPrevia(imovel(4000, 90))?.rotulo, "Caução do 1º bloco (3 meses)");
});

test("E1050 — a prévia da revisão mostra a linha da caução, com o valor formatado", () => {
  assert.match(revisar, /caucaoDaPrevia\(p\.previewProperty\)/);
  assert.match(revisar, /data-testid="previa-preco-caucao"/);
  assert.match(revisar, /\{caucao\.rotulo\}/);
  assert.match(revisar, /formatBRL\(caucao\.valor\)/);
});
