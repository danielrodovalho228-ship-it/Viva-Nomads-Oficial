/*
  E978, refinamento (DUET-2005): o "não mostrar" que o dono marca no editor (nomes do Mapbox) vale para o lugar do OSM que
  se guarda também quando os nomes diferem só em acentos, caixa ou espaços. Antes casava só por nome exato.
  Roda: node --test src/lib/proximidades/e978-nao-mostrar-normalizado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chaveDoLugar, osmParaGravar, type LugarProximo } from "./osm.ts";

const osm: LugarProximo[] = [
  { tipo: "farmacia", categoria: "saude", nome: "Farmácia São João", distanciaM: 300, lat: 1, lng: 1 },
  { tipo: "mercado", categoria: "mercado", nome: "Supermercado Bretas", distanciaM: 500, lat: 2, lng: 2 },
];
const doCep = new Map(osm.map((l) => [chaveDoLugar(l.tipo, l.nome), l]));

test("a chave ignora acentos, caixa e espaços a mais — e mantém tipo, palavras e pontuação", () => {
  assert.equal(chaveDoLugar("farmacia", "  FARMACIA   sao  JOÃO "), chaveDoLugar("farmacia", "Farmácia São João"));
  assert.equal(chaveDoLugar("farmacia", "Farmácia São João"), "farmacia|farmacia sao joao");
  assert.notEqual(chaveDoLugar("farmacia", "Farmácia São João"), chaveDoLugar("mercado", "Farmácia São João"));
  assert.notEqual(chaveDoLugar("farmacia", "Farmácia São João"), chaveDoLugar("farmacia", "Farmácia São João 2"));
  assert.notEqual(chaveDoLugar("mercado", "Bretas"), chaveDoLugar("mercado", "Supermercado Bretas"));
});

test("o 'não mostrar' do editor (grafia do Mapbox) chega ao lugar do OSM com a grafia diferente", () => {
  const r = osmParaGravar([{ tipo: "farmacia", nome: "FARMACIA SAO JOAO", oculto: true }], doCep, osm);
  assert.deepEqual(
    r.map((x) => [x.lugar.nome, x.oculto]),
    [["Farmácia São João", true], ["Supermercado Bretas", false]],
  );
  // O nome guardado é o do OSM (nada do Mapbox entra em armazenamento).
  assert.equal(r[0].lugar.nome, "Farmácia São João");
});

test("salvar o anúncio usa a mesma chave normalizada que a busca do CEP", () => {
  const g = readFileSync(new URL("../data/proximidades-gravar.ts", import.meta.url), "utf8");
  assert.match(g, /const chave = chaveDoLugar;/);
});
