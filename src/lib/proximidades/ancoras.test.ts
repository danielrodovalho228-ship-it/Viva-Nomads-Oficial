/*
  E259 item 7 — "O que tem por perto" com fonte única (assistente × página pública).
  Caso fixado: Av. João Naves de Ávila, 2121, Saraiva, Uberlândia (VN-A02590, prova de publicação de 30/10).
  Roda: node --test src/lib/proximidades/ancoras.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ancorasPerto, juntarComAncoras, respostaPerto, type DestinoAncora } from "./ancoras.ts";
import { consultaOverpass, overpassFalhou, RAIO_ONIBUS_METROS, type LugarProximo } from "./osm.ts";
import { buscaNaoRespondeu } from "../anuncio/proximidades.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

// Ponto PÚBLICO do anúncio (o mesmo do "Tempo até" da página) e as âncoras de Uberlândia, como estão em produção.
const PONTO_PUBLICO = { lat: -18.913856, lng: -48.2617463059656 };
const DESTINOS_UDI: DestinoAncora[] = [
  { nome: "HC-UFU", tipo: "hospital", cidade: "Uberlândia", uf: "MG", lat: -18.8826444, lng: -48.2604348 },
  { nome: "UFU — Campus Santa Mônica", tipo: "universidade", cidade: "Uberlândia", uf: "MG", lat: -18.918473, lng: -48.2581763 },
  { nome: "UFU — Campus Umuarama", tipo: "universidade", cidade: "Uberlândia", uf: "MG", lat: -18.8856766, lng: -48.2574931 },
];
const LOCAL = { cidade: "Uberlândia", uf: "MG" };

test("as âncoras no raio de 2 km do ponto público: só o Campus Santa Mônica (~600 m, como a página diz)", () => {
  const a = ancorasPerto(PONTO_PUBLICO, DESTINOS_UDI, LOCAL);
  assert.deepEqual(a.map((l) => l.nome), ["UFU — Campus Santa Mônica"]);
  assert.equal(a[0].categoria, "educacao");
  assert.equal(a[0].tipo, "universidade");
  // A página diz "≈ 600 m em linha reta" (arredondado a 100 m) — a mesma conta, do mesmo ponto.
  assert.ok(a[0].distanciaM >= 550 && a[0].distanciaM < 650, String(a[0].distanciaM));
  // Outra cidade, ou tipo "outro", não entram; sem cidade, nada.
  assert.deepEqual(ancorasPerto(PONTO_PUBLICO, DESTINOS_UDI, { cidade: "Uberaba", uf: "MG" }), []);
  assert.deepEqual(ancorasPerto(PONTO_PUBLICO, [{ ...DESTINOS_UDI[1], tipo: "outro" }], LOCAL), []);
  assert.deepEqual(ancorasPerto(PONTO_PUBLICO, DESTINOS_UDI, { cidade: null, uf: null }), []);
});

test("o caso da prova: Overpass estourou o tempo nos dois servidores → a UFU aparece, e nunca 'não achamos lugares'", () => {
  const ancoras = ancorasPerto(PONTO_PUBLICO, DESTINOS_UDI, LOCAL);
  const r = respostaPerto({ osm: null, fonteOsm: "erro", referencia: PONTO_PUBLICO, ancoras });
  assert.deepEqual(r.itens.map((l) => l.nome), ["UFU — Campus Santa Mônica"]);
  assert.equal(r.fonte, "ancoras");
  assert.notEqual(r.fonte, "sem_lugares");
  // Sem âncora nem OSM, a falha continua sendo falha ("a busca não respondeu"), não "nada por perto".
  const vazio = respostaPerto({ osm: null, fonteOsm: "erro", referencia: PONTO_PUBLICO, ancoras: [] });
  assert.equal(vazio.fonte, "erro");
  assert.equal(buscaNaoRespondeu(vazio.fonte), true);
  // "sem_lugares" só quando o OSM respondeu e não há âncora no raio.
  assert.equal(respostaPerto({ osm: [], fonteOsm: "osm", referencia: PONTO_PUBLICO, ancoras: [] }).fonte, "sem_lugares");
});

test("OSM e âncora juntos: a âncora vence o mesmo campus do OSM; distâncias do MESMO ponto de referência", () => {
  const ancoras = ancorasPerto(PONTO_PUBLICO, DESTINOS_UDI, LOCAL);
  const osm: LugarProximo[] = [
    // O mesmo campus com o nome longo do OSM, a ~150 m do ponto da âncora: sai.
    { tipo: "universidade", categoria: "educacao", nome: "Universidade Federal de Uberlândia - Campus Santa Mônica", distanciaM: 999, lat: -18.9172, lng: -48.2585 },
    // Distância medida de outro ponto (o do CEP) é refeita a partir da referência.
    { tipo: "farmacia", categoria: "saude", nome: "Farmácia X", distanciaM: 50, lat: -18.9145, lng: -48.2620 },
    // Fora do raio a partir da referência: sai.
    { tipo: "mercado", categoria: "mercado", nome: "Mercado Longe", distanciaM: 100, lat: -18.88, lng: -48.26 },
  ];
  const r = respostaPerto({ osm, fonteOsm: "cache", referencia: PONTO_PUBLICO, ancoras });
  assert.deepEqual(r.itens.map((l) => l.nome), ["Farmácia X", "UFU — Campus Santa Mônica"]);
  const farm = r.itens.find((l) => l.nome === "Farmácia X")!;
  assert.ok(farm.distanciaM > 50 && farm.distanciaM < 150, String(farm.distanciaM));
  assert.equal(r.fonte, "cache");
  // Até 3 por categoria, mais perto primeiro.
  const muitos = Array.from({ length: 5 }, (_, i): LugarProximo => ({ tipo: "escola", categoria: "educacao", nome: `Escola ${i}`, distanciaM: 100 * (i + 1) }));
  assert.deepEqual(juntarComAncoras(muitos, ancoras).map((l) => l.nome), ["Escola 0", "Escola 1", "Escola 2"]);
});

test("Overpass: 200 com remark de tempo estourado é FALHA; paradas de ônibus num raio menor (consulta mais leve)", () => {
  assert.equal(overpassFalhou({ elements: [], remark: "runtime error: Query timed out in \"query\" at line 1 after 20 seconds." }), true);
  assert.equal(overpassFalhou({ elements: [] }), false);
  assert.equal(overpassFalhou({ elements: [{ tags: {} }] }), false);
  assert.equal(overpassFalhou(null), true);
  const q = consultaOverpass(-18.91, -48.26);
  assert.match(q, new RegExp(`node\\["highway"="bus_stop"\\]\\(around:${RAIO_ONIBUS_METROS},`));
  assert.match(q, /node\["amenity"="university"\]\(around:2000,/);
});

test("guarda: a rota usa a mesma fonte (destinos) e o mesmo ponto (público do anúncio); falha não grava lista vazia", () => {
  const rota = ler("src/app/api/proximidades/route.ts");
  assert.match(rota, /from\("destinos"\)\.select\("nome, tipo, cidade, uf, lat, lng"\)\.eq\("ativo", true\)/);
  assert.match(rota, /const referencia = pontoPublico \?\? pontoEndereco;/);
  assert.match(rota, /itens: achados \?\? \[\], fonte: achados \? fonte : "erro"/);
  assert.match(rota, /return responder\(achados, achados \? fonte : "erro", ponto\);/);
  assert.doesNotMatch(rota, /\(await buscarLugares\(ponto, etapas\)\) \?\? \[\]/);
  // O "Tempo até" da página lê a mesma tabela.
  assert.match(ler("src/app/api/tempos/imovel/[id]/route.ts"), /from\("destinos"\)/);
  // O assistente manda o id do anúncio salvo.
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx"), /imovelId: editingId \?\? draftServerId \?\? draftParam \?\? undefined/);
  assert.match(ler("src/lib/proximidades/osm-servidor.ts"), /if \(overpassFalhou\(json\)\) \{/);
});
