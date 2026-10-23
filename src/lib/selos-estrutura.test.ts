import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHECKLIST_ACESSIVEL,
  CHECKLIST_MOBILIDADE_REDUZIDA,
  distanciaKm,
  pertoDeAlgum,
  rotuloSeloEstrutura,
  selosEstrutura,
  type ChecklistEstrutura,
} from "./selos-estrutura.ts";

const marcar = (itens: readonly string[]) => Object.fromEntries(itens.map((i) => [i, true])) as ChecklistEstrutura;

test("Acessível só com os 4 itens marcados", () => {
  assert.deepEqual(selosEstrutura({ checklist: marcar(CHECKLIST_ACESSIVEL) }), ["acessivel"]);
  assert.deepEqual(selosEstrutura({ checklist: marcar(CHECKLIST_ACESSIVEL.slice(1)) }), []);
  assert.deepEqual(selosEstrutura({ checklist: { ...marcar(CHECKLIST_ACESSIVEL), portas80cm: false } }), []);
});

test("Mobilidade reduzida só com os 4 itens marcados, independente do Acessível", () => {
  assert.deepEqual(selosEstrutura({ checklist: marcar(CHECKLIST_MOBILIDADE_REDUZIDA) }), ["mobilidadeReduzida"]);
  assert.deepEqual(selosEstrutura({ checklist: marcar(CHECKLIST_MOBILIDADE_REDUZIDA.slice(0, 3)) }), []);
});

test("sem checklist não há selo", () => {
  assert.deepEqual(selosEstrutura({}), []);
  assert.deepEqual(selosEstrutura({ checklist: null }), []);
});

const centro = { lat: -23.55, lng: -46.63 };

test("distância: ponto igual = 0 e ~1,1 km por 0,01° de latitude", () => {
  assert.equal(distanciaKm(centro, centro), 0);
  const d = distanciaKm(centro, { lat: centro.lat + 0.01, lng: centro.lng });
  assert.ok(d > 1.05 && d < 1.17, String(d));
});

test("Perto de hospital/universidade: até 2 km liga, acima não, sem localização não", () => {
  const perto = { lat: centro.lat + 0.015, lng: centro.lng }; // ~1,7 km
  const longe = { lat: centro.lat + 0.03, lng: centro.lng }; // ~3,3 km
  assert.deepEqual(selosEstrutura({ local: centro, hospitais: [perto] }), ["pertoHospital"]);
  assert.deepEqual(selosEstrutura({ local: centro, universidades: [longe, perto] }), ["pertoUniversidade"]);
  assert.deepEqual(selosEstrutura({ local: centro, hospitais: [longe] }), []);
  assert.deepEqual(selosEstrutura({ local: null, hospitais: [perto] }), []);
  assert.equal(pertoDeAlgum({ lat: NaN, lng: 0 }, [perto]), false);
  assert.equal(pertoDeAlgum(centro, []), false);
});

test("rótulos vêm de config/selos.ts", () => {
  assert.equal(rotuloSeloEstrutura("acessivel"), "Acessível");
  assert.equal(rotuloSeloEstrutura("pertoHospital"), "Perto de hospital");
});
