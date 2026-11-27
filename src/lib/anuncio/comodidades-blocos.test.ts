import { test } from "node:test";
import assert from "node:assert/strict";
import { blocosDeComodidades } from "./comodidades-blocos.ts";
import { agruparComodidades } from "./comodidades.ts";
import { AMENITY_LABEL } from "../amenities.ts";
import type { Property } from "../types.ts";

const L = (k: string) => AMENITY_LABEL[k];
function imovel(tipo: string, chaves: string[], cat: Record<string, string>): Property {
  const grupos = new Map<string, string[]>();
  for (const k of chaves) (grupos.get(cat[k]) ?? grupos.set(cat[k], []).get(cat[k])!).push(L(k));
  return { propertyType: tipo, amenities: [], amenityGroups: [...grupos].map(([category, items]) => ({ category, items })) } as unknown as Property;
}
const CAT = { internet_fibra: "trabalho", sala_reuniao: "trabalho", cozinha_equipada: "conforto", ar_condicionado: "conforto", portaria_24h: "edificio", academia: "edificio", piscina: "edificio", vaga_garagem: "edificio", detector_fumaca: "seguranca" };
const CHAVES = Object.keys(CAT);

test("E661: prédio — Wi-Fi/internet do apartamento fica no bloco do dono; portaria, academia, piscina e sala de reunião vão ao condomínio", () => {
  const p = imovel("apartamento", CHAVES, CAT);
  const b = blocosDeComodidades(agruparComodidades(p), p.propertyType);
  const dono = b.imovel.flatMap((g) => g.items);
  assert.ok(dono.includes(L("internet_fibra")));
  assert.ok(dono.includes(L("cozinha_equipada")) && dono.includes(L("detector_fumaca")));
  assert.ok(dono.includes(L("vaga_garagem")), "a vaga é do apartamento");
  for (const k of ["portaria_24h", "academia", "piscina", "sala_reuniao"]) {
    assert.ok(b.condominio.includes(L(k)), k);
    assert.ok(!dono.includes(L(k)), k);
  }
});

test("E661: casa (fora de condomínio) não tem bloco do condomínio — tudo fica com o dono", () => {
  const p = imovel("casa", ["internet_fibra", "piscina"], CAT);
  const b = blocosDeComodidades(agruparComodidades(p), p.propertyType);
  assert.deepEqual(b.condominio, []);
  assert.ok(b.imovel.flatMap((g) => g.items).includes(L("piscina")));
});

test("E661: nada some nem se repete — dono + condomínio = total", () => {
  const p = imovel("apartamento", CHAVES, CAT);
  const a = agruparComodidades(p);
  const b = blocosDeComodidades(a, p.propertyType);
  assert.equal(b.imovel.flatMap((g) => g.items).length + b.condominio.length, a.total);
});

test("E661: sem item de condomínio, o bloco fica vazio (a seção some)", () => {
  const p = imovel("apartamento", ["internet_fibra"], CAT);
  assert.deepEqual(blocosDeComodidades(agruparComodidades(p), p.propertyType).condominio, []);
});
