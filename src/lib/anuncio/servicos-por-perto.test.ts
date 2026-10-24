import { test } from "node:test";
import assert from "node:assert/strict";
import { proximidadesVisiveis, servicosPorPerto, tipoServico } from "./proximidades.ts";
import type { Proximity } from "../types.ts";

test("adendo 37 + PERTO-B: ônibus, mercado e farmácia — o mais perto, da MESMA lista visível, sem o nome do lugar", () => {
  const lista: Proximity[] = [
    { category: "transporte", name: "Parada Av. Pará", tipo: "onibus", origem: "osm", distanciaM: 480 },
    { category: "transporte", name: "Parada Rua X", tipo: "onibus", origem: "osm", distanciaM: 240 },
    { category: "mercado", name: "Supermercado Bretas", tipo: "mercado", origem: "osm", distanciaM: 960 },
    { category: "saude", name: "Drogasil", tipo: "farmacia", origem: "osm", distanciaM: 1430 },
    { category: "saude", name: "Hospital de Clínicas", tipo: "hospital", origem: "osm", distanciaM: 1800 },
  ];
  const s = servicosPorPerto(proximidadesVisiveis(lista));
  assert.deepEqual(s.map((x) => x.texto), [
    "Ponto de ônibus mais perto: a 200 m",
    "Mercado mais perto: a 1 km",
    "Farmácia mais perto: a 1,4 km",
  ]);
  for (const x of s) assert.doesNotMatch(x.texto, /Bretas|Drogasil|Parada|min/);
  assert.equal(tipoServico({ categoria: "saude", tipo: "hospital", nome: "Hospital de Clínicas" }), null, "hospital não é farmácia");
});

test("serviço sem dado não aparece; oculto não vira chip", () => {
  assert.deepEqual(servicosPorPerto(proximidadesVisiveis([{ category: "mercado", name: "Mercado", note: "5 min a pé" }])), []);
  assert.deepEqual(servicosPorPerto(proximidadesVisiveis([{ category: "mercado", name: "Mercado", tipo: "mercado", distanciaM: 300, oculto: true }])), []);
  assert.deepEqual(servicosPorPerto([]), []);
});
