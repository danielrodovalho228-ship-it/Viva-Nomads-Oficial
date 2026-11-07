/*
  E673 (07/11, retomada do E652): depois do Aditivo 1 (17/01–17/03/2027) o cabeçalho do anúncio seguia "Disponível a partir
  de 10/01/2027" — a data que o dono escolheu no cadastro, sem olhar os períodos já ocupados. O cabeçalho agora diz a
  PRIMEIRA ENTRADA POSSÍVEL: a primeira data (a partir do início do anúncio e de hoje) em que cabe a estadia mínima sem
  cruzar um dia ocupado.
  Roda: node --test src/lib/imovel/e673-disponivel-a-partir.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { primeiraEntradaPossivel } from "./disponivel-a-partir.ts";

const dias = (de: string, ate: string) => {
  const r: string[] = [];
  for (let d = new Date(`${de}T00:00:00Z`); d <= new Date(`${ate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) r.push(d.toISOString().slice(0, 10));
  return r;
};
const base = { from: "2027-01-10", until: null, minDias: 30, hoje: "2026-11-07" };

test("E673: sem período ocupado, é a data do anúncio", () => {
  assert.equal(primeiraEntradaPossivel({ ...base, ocupados: [] }), "2027-01-10");
});

test("E673: contrato 10/01–10/03 ocupa o começo → primeira entrada em 11/03", () => {
  assert.equal(primeiraEntradaPossivel({ ...base, ocupados: dias("2027-01-10", "2027-03-10") }), "2027-03-11");
});

test("E673: depois do aditivo (17/01–17/03) os 7 dias antes não comportam a estadia mínima → 18/03", () => {
  assert.equal(primeiraEntradaPossivel({ ...base, ocupados: dias("2027-01-17", "2027-03-17") }), "2027-03-18");
});

test("E673: se a estadia mínima cabe antes do período ocupado, a data do anúncio vale", () => {
  assert.equal(primeiraEntradaPossivel({ ...base, minDias: 5, ocupados: dias("2027-01-17", "2027-03-17") }), "2027-01-10");
});

test("E673: data do anúncio no passado parte de hoje; tudo ocupado até o fim da janela → null", () => {
  assert.equal(primeiraEntradaPossivel({ from: "2026-01-01", until: null, minDias: 30, hoje: "2026-11-07", ocupados: [] }), "2026-11-07");
  assert.equal(primeiraEntradaPossivel({ ...base, until: "2027-02-20", ocupados: dias("2027-01-10", "2027-03-10") }), null);
});

test("E673: o cabeçalho do calendário e o cartão de preço usam a data efetiva", () => {
  const cal = readFileSync(new URL("../../components/property/availability-calendar.tsx", import.meta.url), "utf8");
  assert.match(cal, /primeiraEntradaPossivel\(/);
  assert.match(cal, /data-testid="disponivel-a-partir"/);
  const card = readFileSync(new URL("../../components/property/price-card.tsx", import.meta.url), "utf8");
  assert.match(card, /disponivelDesde/);
});
