/*
  E978 opção (i) (coordenador, DUET-1540): o editor busca as proximidades AO VIVO no Mapbox — nunca preso ao Overpass.
  A lista GUARDADA para a página pública continua só do OSM (ponto do Nominatim + lista do Overpass); o Mapbox nunca
  entra em armazenamento nem em cache (termos do nível gratuito). O token é só do servidor (MAPBOX_SERVER_TOKEN).
  Roda: node --test src/lib/proximidades/e978-mapbox-editor.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATEGORIAS_MAPBOX, lugaresDoMapbox, tokenMapboxServidor, urlCategoriaMapbox } from "./mapbox.ts";
import { osmParaGravar, type LugarProximo } from "./osm.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const origem = { lat: -18.9456, lng: -48.3245 };
/** Ponto a ~d metros ao norte da origem. */
const norte = (d: number) => ({ lat: origem.lat + d / 111_320, lng: origem.lng });
const feature = (nome: string | null, p: { lat: number; lng: number }) => ({ type: "Feature", geometry: { type: "Point", coordinates: [p.lng, p.lat] }, properties: nome == null ? {} : { name: nome } });
const colecao = (...f: unknown[]) => ({ type: "FeatureCollection", features: f });

test("token: só a variável de SERVIDOR (MAPBOX_SERVER_TOKEN); o NEXT_PUBLIC dos mapas nunca é usado aqui", () => {
  assert.equal(tokenMapboxServidor({ MAPBOX_SERVER_TOKEN: " sk.abc " }), "sk.abc");
  assert.equal(tokenMapboxServidor({ NEXT_PUBLIC_MAPBOX_TOKEN: "pk.publico" }), null);
  assert.equal(tokenMapboxServidor({}), null);
  for (const f of ["lib/proximidades/mapbox.ts", "lib/proximidades/mapbox-servidor.ts", "app/api/proximidades/route.ts"]) assert.doesNotMatch(ler(f), /NEXT_PUBLIC_MAPBOX/, f);
});

test("URL da busca por categoria: perto do ponto (proximity lng,lat), dentro do raio (bbox), em português, no Brasil", () => {
  const u = new URL(urlCategoriaMapbox("pharmacy", origem, "sk.abc", 2000));
  assert.equal(u.origin + u.pathname, "https://api.mapbox.com/search/searchbox/v1/category/pharmacy");
  assert.equal(u.searchParams.get("proximity"), `${origem.lng},${origem.lat}`);
  assert.equal(u.searchParams.get("access_token"), "sk.abc");
  assert.equal(u.searchParams.get("language"), "pt");
  assert.equal(u.searchParams.get("country"), "BR");
  const [minLng, minLat, maxLng, maxLat] = u.searchParams.get("bbox")!.split(",").map(Number);
  assert.ok(minLng < origem.lng && maxLng > origem.lng && minLat < origem.lat && maxLat > origem.lat);
  assert.ok(Number(u.searchParams.get("limit")) <= 25);
});

test("cada tipo da tela tem categoria do Mapbox (empresa vem só das âncoras)", () => {
  for (const t of ["hospital", "universidade", "escola", "mercado", "farmacia", "academia", "onibus", "coworking"] as const) assert.ok(CATEGORIAS_MAPBOX[t].length > 0, t);
  assert.equal("empresa" in CATEGORIAS_MAPBOX, false);
});

test("lê a resposta do Mapbox com a MESMA escolha do OSM: até 3 por categoria, raio, parada até 600 m, parada sem nome", () => {
  const itens = lugaresDoMapbox(
    [
      { tipo: "farmacia", json: colecao(feature("Drogaria A", norte(300)), feature("Drogaria B", norte(100)), feature("Drogaria C", norte(900)), feature("Drogaria D", norte(1200)), feature("Longe", norte(2600))) },
      { tipo: "onibus", json: colecao(feature(null, norte(80)), feature("Ponto distante", norte(800))) },
      { tipo: "mercado", json: { erro: "não é FeatureCollection" } },
    ],
    origem,
  );
  const farmacias = itens.filter((i) => i.tipo === "farmacia").map((i) => i.nome);
  assert.deepEqual(farmacias, ["Drogaria B", "Drogaria A", "Drogaria C"]);
  assert.deepEqual(itens.filter((i) => i.tipo === "onibus").map((i) => i.nome), ["Parada de ônibus"]);
  assert.equal(itens.some((i) => i.nome === "Longe" || i.nome === "Ponto distante"), false);
  for (const i of itens) assert.ok(i.lat != null && i.lng != null && i.distanciaM >= 0);
});

test("rota: o editor responde com o Mapbox ao vivo; a perna OSM (Overpass) vai DEPOIS da resposta (after) e só ela grava o cache", () => {
  const r = ler("app/api/proximidades/route.ts");
  assert.match(r, /import \{ after, NextResponse \} from "next\/server";/);
  assert.match(r, /buscarLugaresMapbox\(/);
  assert.match(r, /after\(/);
  // O que vai para proximidades_cep.itens é só o achado do Overpass — nunca a lista do Mapbox.
  for (const m of r.matchAll(/from\("proximidades_cep"\)\.upsert\(\{([^}]*)\}/g)) assert.doesNotMatch(m[1], /mapbox|aoVivo/i, m[1]);
  assert.doesNotMatch(r, /itens: aoVivo|itens: daMapbox/);
});

test("guardar: a lista automática é a do OSM do CEP (o editor mostra o Mapbox); \"não mostrar\" vale para o mesmo lugar", () => {
  const cache: LugarProximo[] = [
    { tipo: "farmacia", categoria: "saude", nome: "Drogaria Jardim Europa", distanciaM: 310, lat: 1, lng: 1 },
    { tipo: "mercado", categoria: "mercado", nome: "Mercado Jardim Europa", distanciaM: 260, lat: 2, lng: 2 },
  ];
  const doCep = new Map(cache.map((l) => [`${l.tipo}|${l.nome.toLowerCase()}`, l]));
  // O editor mandou o que mostrou (Mapbox): um nome que também está no OSM (oculto) e outro só do Mapbox.
  const r = osmParaGravar(
    [
      { tipo: "mercado", nome: "Mercado Jardim Europa", oculto: true },
      { tipo: "farmacia", nome: "Farmácia só no Mapbox", oculto: false },
    ],
    doCep,
    cache,
  );
  assert.deepEqual(r.map((x) => [x.lugar.nome, x.oculto]), [["Mercado Jardim Europa", true], ["Drogaria Jardim Europa", false]]);
  // Sem lista do OSM (a perna falhou), nada do que o editor mandou entra.
  assert.deepEqual(osmParaGravar([{ tipo: "farmacia", nome: "Farmácia só no Mapbox", oculto: false }], new Map(), []), []);
});

test("salvar o anúncio: com o token, a lista automática gravada passa por osmParaGravar (nunca o que o editor mostrou)", () => {
  const g = ler("lib/data/proximidades-gravar.ts");
  assert.match(g, /tokenMapboxServidor\(\)/);
  assert.match(g, /osmParaGravar\(enviados, doCep, listaDoCep\)/);
  assert.match(g, /if \(listaOsm\) continue;/);
});
