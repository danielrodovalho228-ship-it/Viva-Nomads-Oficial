import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHECKLIST_ACESSIVEL,
  CHECKLIST_MOBILIDADE_REDUZIDA,
  distanciaKm,
  seloAcessivel,
  validarChecklistEstrutura,
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


test("validarChecklistEstrutura: aceita só as chaves conhecidas com booleano", () => {
  const r = validarChecklistEstrutura({ portas80cm: true, boxSemDegrau: false });
  assert.deepEqual(r, { ok: true, checklist: { portas80cm: true, boxSemDegrau: false } });
});

test("validarChecklistEstrutura: recusa chave desconhecida, valor não booleano e entrada que não é objeto", () => {
  assert.equal(validarChecklistEstrutura({ cadeiraDeRodas: true }).ok, false);
  assert.equal(validarChecklistEstrutura({ portas80cm: "sim" }).ok, false);
  assert.equal(validarChecklistEstrutura(null).ok, false);
  assert.equal(validarChecklistEstrutura([true]).ok, false);
});

test("validarChecklistEstrutura: checklist completo liga o selo Acessível; incompleto não", () => {
  const completo = Object.fromEntries(CHECKLIST_ACESSIVEL.map((k) => [k, true]));
  const v = validarChecklistEstrutura(completo);
  assert.equal(v.ok && seloAcessivel(v.checklist), true);
  const parcial = validarChecklistEstrutura({ portas80cm: true });
  assert.equal(parcial.ok && seloAcessivel(parcial.checklist), false);
});
