/* Roda: node --test src/lib/proximidades/ponto-de-medida.test.ts — E389: uma regra só para o ponto de onde se mede a distância. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { escolherPontoDeMedida } from "./ponto-de-medida.ts";

test("E389: o ponto exato vence o público (arredondado em 3 casas)", () => {
  const p = escolherPontoDeMedida({ lat: -18.9186, lng: -48.2584 }, { lat: -18.919, lng: -48.258 });
  assert.deepEqual(p, { lat: -18.9186, lng: -48.2584 });
});

test("E389: sem ponto exato (ou zerado), vale o público; sem nenhum, nada", () => {
  assert.deepEqual(escolherPontoDeMedida({ lat: null, lng: null }, { lat: -18.919, lng: -48.258 }), { lat: -18.919, lng: -48.258 });
  assert.deepEqual(escolherPontoDeMedida({ lat: 0, lng: 0 }, { lat: -18.919, lng: -48.258 }), { lat: -18.919, lng: -48.258 });
  assert.equal(escolherPontoDeMedida({ lat: undefined, lng: undefined }, { lat: NaN, lng: NaN }), null);
});

test("E389: a rota mede âncoras e lugares do mesmo ponto (a mesma função nos dois caminhos)", () => {
  const r = readFileSync("src/app/api/proximidades/route.ts", "utf8");
  assert.match(r, /import \{ escolherPontoDeMedida \} from "@\/lib\/proximidades\/ponto-de-medida";/);
  const publico = r.slice(r.indexOf("async function pontoPublicoDoAnuncio"), r.indexOf("async function origemDoAnuncio"));
  assert.match(publico, /select\("owner_id, lat, lng, lat_exata, lng_exata"\)/);
  assert.match(publico, /return escolherPontoDeMedida\(\{ lat: data\.lat_exata, lng: data\.lng_exata \}, \{ lat: data\.lat, lng: data\.lng \}\);/);
  const endereco = r.slice(r.indexOf("async function enderecoDoAnuncio"));
  assert.match(endereco, /const ponto = escolherPontoDeMedida\(/);
});
