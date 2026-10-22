import { test } from "node:test";
import assert from "node:assert/strict";
import { idealPara, idealParaRotulos, IDEAL_PARA_MAX } from "./ideal-para.ts";

const base = { workFeatures: [], internetTier: undefined, bedrooms: 1, furnished: false, amenities: [], petsAllowed: false };

test("sem nenhum dado, não há 'Ideal para'", () => {
  assert.deepEqual(idealPara(base), []);
});

test("Home office exige mesa E internet informada (só um dos dois não liga)", () => {
  assert.deepEqual(idealPara({ ...base, workFeatures: ["Mesa de trabalho"], internetTier: "home_office" }), ["homeOffice"]);
  assert.deepEqual(idealPara({ ...base, workFeatures: ["Mesa de trabalho"] }), []);
  assert.deepEqual(idealPara({ ...base, internetTier: "home_office" }), []);
});

test("Família liga com 2+ quartos, não com 1", () => {
  assert.deepEqual(idealPara({ ...base, bedrooms: 2 }), ["familia"]);
  assert.deepEqual(idealPara({ ...base, bedrooms: 1 }), []);
});

test("Executivo exige mobiliado E 'Mobiliado completo'", () => {
  assert.deepEqual(idealPara({ ...base, furnished: true, amenities: ["Mobiliado completo"] }), ["executivo"]);
  assert.deepEqual(idealPara({ ...base, furnished: true, amenities: ["Ar-condicionado"] }), []);
  assert.deepEqual(idealPara({ ...base, furnished: false, amenities: ["Mobiliado completo"] }), []);
});

test("Com pet liga só quando aceita pet", () => {
  assert.deepEqual(idealPara({ ...base, petsAllowed: true }), ["comPet"]);
  assert.deepEqual(idealPara({ ...base, petsAllowed: false }), []);
});

test("Com pet vem PRIMEIRO e sempre entra (atributo declarado vence inferência — #910)", () => {
  const tudo = {
    workFeatures: ["Mesa de trabalho"],
    internetTier: "home_office" as const,
    bedrooms: 3,
    furnished: true,
    amenities: ["Mobiliado completo"],
    petsAllowed: true,
  };
  assert.equal(IDEAL_PARA_MAX, 3);
  assert.deepEqual(idealPara(tudo), ["comPet", "homeOffice", "familia"]);
  assert.deepEqual(idealParaRotulos(tudo), ["Com pet", "Home office", "Família"]);
  // Só pet + mais uma: pet primeiro.
  assert.deepEqual(idealPara({ ...base, bedrooms: 2, petsAllowed: true }), ["comPet", "familia"]);
});

test("sem pet, a ordem de antes não muda (no máximo 3)", () => {
  const semPet = {
    workFeatures: ["Mesa de trabalho"],
    internetTier: "home_office" as const,
    bedrooms: 3,
    furnished: true,
    amenities: ["Mobiliado completo"],
    petsAllowed: false,
  };
  assert.deepEqual(idealPara(semPet), ["homeOffice", "familia", "executivo"]);
  assert.deepEqual(idealParaRotulos(semPet), ["Home office", "Família", "Executivo"]);
});

test("Prompt 57: home office com internet medida vem primeiro e substitui o informado; vencida ou fraca volta ao informado", () => {
  const agora = new Date("2026-10-23T12:00:00Z");
  const medida = { downloadMbps: 328, uploadMbps: 42, latenciaMs: 12, medidoEm: "2026-10-22T15:00:00Z", validoAte: "2027-04-22T15:00:00Z" };
  const p = { ...base, workFeatures: ["Mesa de trabalho"], internetTier: "home_office" as const, petsAllowed: true, internetMedida: medida, agora };
  assert.deepEqual(idealPara(p), ["homeOfficeMedido", "comPet"]);
  assert.deepEqual(idealParaRotulos(p)[0], "Home office · internet medida");
  assert.deepEqual(idealPara({ ...p, agora: new Date("2027-05-01T00:00:00Z") }), ["comPet", "homeOffice"]);
  assert.deepEqual(idealPara({ ...p, internetMedida: { ...medida, uploadMbps: 2 } }), ["comPet", "homeOffice"]);
});
