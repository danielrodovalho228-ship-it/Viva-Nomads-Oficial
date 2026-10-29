import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHECKLIST_ACESSIVEL,
  CHECKLIST_MOBILIDADE_REDUZIDA,
  distanciaKm,
  seloAcessivel,
  validarChecklistEstrutura,
  pertoDeAlgum,
  estruturaInformada,
  temEstruturaInformada,
  pontosDaCidade,
  selosDoAnuncio,
  ITENS_ESTRUTURA,
  GRUPOS_ESTRUTURA,
  NOTA_ESTRUTURA_INFORMADA,
  type ItemChecklist,
  type ProvaItemEstrutura,
  rotuloSeloEstrutura,
  selosEstrutura,
  type ChecklistEstrutura,
} from "./selos-estrutura.ts";

const marcar = (itens: readonly string[]) => Object.fromEntries(itens.map((i) => [i, true])) as ChecklistEstrutura;

const provar = (itens: readonly ItemChecklist[], aprovada = true): ProvaItemEstrutura[] => itens.map((item) => ({ item, origem: "foto_na_hora", aprovada }));

test("E225-A: os 4 itens do Acessível marcados SEM prova → o selo NÃO aparece (autodeclaração não dá selo)", () => {
  assert.deepEqual(selosEstrutura({ checklist: marcar(CHECKLIST_ACESSIVEL) }), []);
  assert.deepEqual(selosEstrutura({ checklist: marcar(CHECKLIST_ACESSIVEL), provas: [] }), []);
  assert.equal(seloAcessivel(marcar(CHECKLIST_ACESSIVEL)), false);
});

test("E225-A: selo Acessível só com os 4 itens marcados E a prova APROVADA de cada um", () => {
  assert.deepEqual(selosEstrutura({ checklist: marcar(CHECKLIST_ACESSIVEL), provas: provar(CHECKLIST_ACESSIVEL) }), ["acessivel"]);
  // Falta a prova de um item, ou a prova ainda não foi aprovada: sem selo.
  assert.deepEqual(selosEstrutura({ checklist: marcar(CHECKLIST_ACESSIVEL), provas: provar(CHECKLIST_ACESSIVEL.slice(1)) }), []);
  assert.deepEqual(selosEstrutura({ checklist: marcar(CHECKLIST_ACESSIVEL), provas: provar(CHECKLIST_ACESSIVEL, false) }), []);
  // Prova sem o item marcado também não dá selo.
  assert.deepEqual(selosEstrutura({ checklist: { ...marcar(CHECKLIST_ACESSIVEL), portas80cm: false }, provas: provar(CHECKLIST_ACESSIVEL) }), []);
  // O gancho da vistoria: prova aprovada pela vistoria vale igual.
  const vistoria = CHECKLIST_ACESSIVEL.map((item) => ({ item, origem: "vistoria" as const, aprovada: true }));
  assert.deepEqual(selosEstrutura({ checklist: marcar(CHECKLIST_ACESSIVEL), provas: vistoria }), ["acessivel"]);
});

test("E225-A: Mobilidade reduzida segue a mesma regra, independente do Acessível", () => {
  assert.deepEqual(selosEstrutura({ checklist: marcar(CHECKLIST_MOBILIDADE_REDUZIDA) }), []);
  assert.deepEqual(selosEstrutura({ checklist: marcar(CHECKLIST_MOBILIDADE_REDUZIDA), provas: provar(CHECKLIST_MOBILIDADE_REDUZIDA) }), ["mobilidadeReduzida"]);
  assert.deepEqual(selosEstrutura({ checklist: marcar(CHECKLIST_MOBILIDADE_REDUZIDA.slice(0, 3)), provas: provar(CHECKLIST_MOBILIDADE_REDUZIDA) }), []);
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

test("validarChecklistEstrutura: checklist completo e válido ainda não liga o selo sem prova", () => {
  const completo = Object.fromEntries(CHECKLIST_ACESSIVEL.map((k) => [k, true]));
  const v = validarChecklistEstrutura(completo);
  assert.equal(v.ok, true);
  assert.equal(v.ok && seloAcessivel(v.checklist), false);
  assert.equal(v.ok && seloAcessivel(v.checklist, provar(CHECKLIST_ACESSIVEL)), true);
});

test("E225-A: os 8 itens em dois grupos, cada um com nome e linha de critério", () => {
  assert.deepEqual(GRUPOS_ESTRUTURA.map((g) => g.titulo), ["Acessibilidade", "Mobilidade reduzida"]);
  assert.deepEqual(GRUPOS_ESTRUTURA.flatMap((g) => g.itens), [...CHECKLIST_ACESSIVEL, ...CHECKLIST_MOBILIDADE_REDUZIDA]);
  for (const k of [...CHECKLIST_ACESSIVEL, ...CHECKLIST_MOBILIDADE_REDUZIDA]) assert.ok(ITENS_ESTRUTURA[k].rotulo && ITENS_ESTRUTURA[k].criterio, k);
  assert.equal(ITENS_ESTRUTURA.portas80cm.criterio, "Portas com pelo menos 80 cm de vão livre");
  assert.equal(NOTA_ESTRUTURA_INFORMADA, "Informado pelo proprietário. Confirme na visita.");
});

test("E225-A: o anúncio lista SÓ os itens marcados como sim; nada marcado = nada aparece", () => {
  assert.deepEqual(estruturaInformada(null), []);
  assert.deepEqual(estruturaInformada({}), []);
  assert.deepEqual(estruturaInformada({ portas80cm: false, boxSemDegrau: false }), []);
  assert.equal(temEstruturaInformada({ portas80cm: false }), false);
  assert.deepEqual(estruturaInformada({ portas80cm: true, elevadorOuTerreo: false, boxSemDegrau: true }), [
    { titulo: "Acessibilidade", itens: ["Portas largas"] },
    { titulo: "Mobilidade reduzida", itens: ["Box sem degrau"] },
  ]);
  assert.equal(temEstruturaInformada({ boxSemDegrau: true }), true);
});

test("E225-A: 'Perto de…' só com a lista de pontos VERIFICADOS da cidade; sem lista, nada", () => {
  const tipos = { hc: "hospital", campus: "universidade" } as const;
  const pontos = [
    { slug: "hc", cidade: "uberlandia", lat: centro.lat + 0.01, lng: centro.lng, verificado: true },
    { slug: "campus", cidade: "uberlandia", lat: centro.lat + 0.01, lng: centro.lng, verificado: false },
  ];
  assert.equal(pontosDaCidade("outra", pontos, tipos), null);
  assert.equal(pontosDaCidade(undefined, pontos, tipos), null);
  const p = pontosDaCidade("uberlandia", pontos, tipos);
  assert.deepEqual(p?.universidades, []);
  assert.deepEqual(selosDoAnuncio({ local: centro, pontosDaCidade: p }), ["pertoHospital"]);
  assert.deepEqual(selosDoAnuncio({ local: centro, pontosDaCidade: null }), []);
});
