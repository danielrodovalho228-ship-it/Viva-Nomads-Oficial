/*
  E844 (Phoenix RELATORIO-016, A-04/A-05): o filtro "Para trabalhar de casa" dos anúncios de exemplo lia um tagHomeOffice
  posto à mão em properties.ts — ube-004 e ube-007 têm a MESMA estrutura de trabalho (mesa/bancada + internet de trabalho) e
  só o 007 entrava. Regra: o exemplo passa pela MESMA regra do anúncio real (qualification.tagHomeOffice: cômodo de trabalho,
  mesa, cadeira e internet que aguenta trabalho), lida do que o exemplo lista em "Estrutura de trabalho" e da internet.
  Roda: node --test src/lib/exemplos/e844-home-office-exemplo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { SAMPLE_PROPERTIES } from "../properties.ts";
import { estruturaDeTrabalhoDoExemplo, tagHomeOfficeDoExemplo } from "./home-office-exemplo.ts";

const porId = (id: string) => SAMPLE_PROPERTIES.find((p) => p.id === id)!;

test("o selo de todo exemplo é o resultado da regra única (nunca um valor posto à mão)", () => {
  const divergentes = SAMPLE_PROPERTIES.filter((p) => p.tagHomeOffice !== tagHomeOfficeDoExemplo(p)).map((p) => p.id);
  assert.deepEqual(divergentes, []);
});

test("mesma estrutura de trabalho, mesmo resultado (ube-004 × ube-007)", () => {
  assert.deepEqual(estruturaDeTrabalhoDoExemplo(porId("ube-004")), estruturaDeTrabalhoDoExemplo(porId("ube-007")));
  assert.equal(porId("ube-004").tagHomeOffice, porId("ube-007").tagHomeOffice);
});

test("a regra: cômodo + mesa + cadeira + internet de trabalho; faltando um, sem o selo", () => {
  const base = { workFeatures: ["Escritório dedicado", "Mesa de trabalho", "Cadeira ergonômica"], internetTier: "home_office" } as const;
  assert.equal(tagHomeOfficeDoExemplo(base), true);
  assert.equal(tagHomeOfficeDoExemplo({ ...base, workFeatures: ["Escritório dedicado", "Cadeira ergonômica"] }), false);
  assert.equal(tagHomeOfficeDoExemplo({ ...base, workFeatures: ["Mesa de trabalho", "Cadeira ergonômica"] }), false);
  assert.equal(tagHomeOfficeDoExemplo({ ...base, internetTier: "basica" as never }), false);
  // "Bancada de trabalho" e "Mesa de estudos" contam como mesa.
  assert.equal(estruturaDeTrabalhoDoExemplo({ workFeatures: ["Bancada de trabalho"] }).hasDesk, true);
  assert.equal(estruturaDeTrabalhoDoExemplo({ workFeatures: ["Mesa de estudos"] }).hasDesk, true);
});
