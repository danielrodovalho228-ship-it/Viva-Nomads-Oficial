import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chipsDe,
  FILTROS_DESCRICAO_VAZIOS,
  interpretarLocal,
  limparDescricao,
  localExistente,
  sanearFiltros,
  semFiltro,
  temFiltro,
} from "./descricao-filtros.ts";

const LOCAIS = ["Uberlândia", "Umuarama", "Centro", "Santa Mônica"];

test("exemplo da ordem vira filtros: 2 quartos, perto do HC, gato, até 2.500", () => {
  const f = interpretarLocal("2 quartos perto do HC, aceita gato, até 2.500", LOCAIS);
  assert.equal(f.minBedrooms, 2);
  assert.equal(f.maxPrice, 2500);
  assert.equal(f.petsOnly, true);
  assert.equal(f.local, "Umuarama");
});

test("preço em formatos comuns", () => {
  assert.equal(interpretarLocal("até R$ 3500").maxPrice, 3500);
  assert.equal(interpretarLocal("no máximo 2,5 mil").maxPrice, 2500);
  assert.equal(interpretarLocal("até 3 mil").maxPrice, 3000);
  assert.equal(interpretarLocal("até 5").maxPrice, 0, "valor absurdo é ignorado");
});

test("quartos por extenso e teto de 3+", () => {
  assert.equal(interpretarLocal("dois quartos").minBedrooms, 2);
  assert.equal(interpretarLocal("5 quartos").minBedrooms, 3);
});

test("comodidades, home office e porte do pet", () => {
  const f = interpretarLocal("cachorro grande, wi-fi, garagem e home office", LOCAIS);
  assert.deepEqual(f.comodidades, ["wifi", "garagem"]);
  assert.equal(f.homeOfficeOnly, true);
  assert.equal(f.petPorte, "G");
});

test("'sem pet' não liga o filtro de pets; texto vazio não filtra nada", () => {
  assert.equal(interpretarLocal("sem pets").petsOnly, false);
  assert.equal(temFiltro(interpretarLocal("")), false);
});

test("cidade citada só vale se existe no catálogo", () => {
  assert.equal(interpretarLocal("apartamento em Uberlândia", LOCAIS).local, "Uberlândia");
  assert.equal(interpretarLocal("apartamento em Paris", LOCAIS).local, "");
});

test("limparDescricao tira telefone, e-mail e link e corta em 200 caracteres", () => {
  const t = limparDescricao("ligue (34) 99999-1234 ou a@b.com www.x.com casa " + "x".repeat(300));
  assert.ok(!/99999|@|www/.test(t));
  assert.ok(t.length <= 200);
});

test("sanearFiltros descarta o que a IA inventar", () => {
  const f = sanearFiltros({
    maxPrice: 999999999,
    minBedrooms: 9,
    petsOnly: true,
    petPorte: "XG",
    comodidades: ["wifi", "piscina", "wifi"],
    local: "Centro (34) 99999-1234",
    extra: "ignorado",
  });
  assert.equal(f.maxPrice, 0);
  assert.equal(f.minBedrooms, 3);
  assert.equal(f.petPorte, "");
  assert.deepEqual(f.comodidades, ["wifi"]);
  assert.ok(!/99999/.test(f.local));
  assert.deepEqual(sanearFiltros("lixo"), FILTROS_DESCRICAO_VAZIOS);
  assert.deepEqual(sanearFiltros(null), FILTROS_DESCRICAO_VAZIOS);
});

test("chips mostram os filtros e semFiltro tira só o escolhido", () => {
  const f = interpretarLocal("2 quartos, aceita gato pequeno, até 2.500, wi-fi", []);
  assert.deepEqual(
    chipsDe(f).map((c) => c.rotulo),
    ["Até R$ 2.500", "2+ quartos", "Aceita pets (pequeno)", "Wi-Fi"]
  );
  const g = semFiltro(f, "petsOnly");
  assert.equal(g.petsOnly, false);
  assert.equal(g.petPorte, "");
  assert.equal(g.minBedrooms, 2);
  assert.deepEqual(semFiltro(f, "wifi").comodidades, []);
});

test("localExistente só devolve lugar do catálogo", () => {
  assert.equal(localExistente("uberlandia", LOCAIS), "Uberlândia");
  assert.equal(localExistente("Narnia", LOCAIS), "");
});
