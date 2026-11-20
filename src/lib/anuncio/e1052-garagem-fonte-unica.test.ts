/*
  E1052 — trava: a página do imóvel afirmava e negava "vaga de garagem" ao mesmo tempo. A linha-síntese lê o campo de
  vagas (`parkingSpots`: "2 vagas") e o "Não tem" lia só a lista de comodidades — sem "Vaga de garagem" marcada, o
  mesmo anúncio dizia "2 vagas" e "Não tem: Vaga de garagem".
  Correção: um facto só, `temVagaDeGaragem(property)` (campo de vagas > 0 OU comodidade de vaga marcada). O "Não tem"
  só nega a vaga quando esse facto é falso.
  Roda: node --test src/lib/anuncio/e1052-garagem-fonte-unica.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { comodidadesQueNaoTem, temVagaDeGaragem } from "./nao-tem.ts";
import type { Property } from "../types.ts";

const base = { propertyType: "Apartamento", amenityGroups: [] } as unknown as Property;
const casos: { nome: string; p: Property }[] = [
  { nome: "2 vagas no campo, sem a comodidade marcada", p: { ...base, parkingSpots: 2, amenities: ["Wi-Fi", "Ar-condicionado"] } },
  { nome: "1 vaga no campo e a comodidade marcada", p: { ...base, parkingSpots: 1, amenities: ["Vaga de garagem", "TV"] } },
  { nome: "campo 0 e a comodidade marcada", p: { ...base, parkingSpots: 0, amenities: ["Vaga de garagem", "TV"] } },
  { nome: "sem campo e sem comodidade", p: { ...base, amenities: ["TV"] } },
  { nome: "campo 0 e sem comodidade", p: { ...base, parkingSpots: 0, amenities: ["TV"] } },
];
/** O que a página AFIRMA: a linha-síntese ("N vagas") ou a lista "Tem" com uma vaga. */
const afirma = (p: Property) => (p.parkingSpots ?? 0) > 0 || p.amenities.some((a) => /vaga|garagem|estacionamento/i.test(a));
const nega = (p: Property) => comodidadesQueNaoTem(p).includes("Vaga de garagem");

test("E1052 — a página nunca afirma e nega a vaga de garagem ao mesmo tempo", () => {
  for (const { nome, p } of casos) assert.ok(!(afirma(p) && nega(p)), nome);
});

test("E1052 — um facto só: temVagaDeGaragem decide; sem vaga em lado nenhum, o 'Não tem' continua a dizer", () => {
  for (const { nome, p } of casos) {
    assert.equal(temVagaDeGaragem(p), afirma(p), nome);
    assert.equal(nega(p), !temVagaDeGaragem(p), nome);
  }
});

test("E1052 — o 'Não tem' lê temVagaDeGaragem (não só a lista de comodidades)", () => {
  const fonte = readFileSync(new URL("./nao-tem.ts", import.meta.url), "utf8");
  const corpo = fonte.slice(fonte.indexOf("export function comodidadesQueNaoTem("));
  assert.match(corpo, /temVagaDeGaragem\(property\)/);
});
