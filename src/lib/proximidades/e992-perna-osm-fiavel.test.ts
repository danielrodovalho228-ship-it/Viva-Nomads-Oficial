/*
  E992 — fiabilidade da perna OSM que GUARDA a lista da página pública: repetição com espera, rodízio de servidores,
  orçamento de tempo e falha honesta; o que se guarda é só do OSM (ponto do Nominatim + lista do Overpass).
  Roda: node --test src/lib/proximidades/e992-perna-osm-fiavel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ORCAMENTO_OVERPASS_MS, comRodizio, planoOverpass, repetivel, retryAfterMs, type Relogio, type ResultadoTentativa } from "./tentativas-osm.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const A = "https://a.test/api/interpreter";
const B = "https://b.test/api/interpreter";

/** Relógio falso: dormir e cada tentativa avançam o tempo; guarda as esperas e os pedidos. */
function falso(duracaoTentativaMs = 1000) {
  let t = 0;
  const esperas: number[] = [];
  const relogio: Relogio = { agora: () => t, dormir: async (ms) => void (esperas.push(ms), (t += ms)) };
  const pedidos: { url: string; tempoMs: number }[] = [];
  const tentarCom = (respostas: ({ ok: string } | { falha: ResultadoTentativa; retryAfterMs?: number | null })[]) => async (url: string, tempoMs: number) => {
    pedidos.push({ url, tempoMs });
    t += Math.min(duracaoTentativaMs, tempoMs);
    const r = respostas.shift();
    if (!r) throw new Error("pedido além do esperado");
    return r;
  };
  return { relogio, esperas, pedidos, tentarCom };
}

test("repete só o que pode passar: 429, 5xx, tempo estourado/rede e 200 com remark; 400/403/404 não", () => {
  for (const r of [{ status: 429 }, { status: 500 }, { status: 504 }, { erro: "TimeoutError" }, { erro: "TypeError" }, { remark: true as const }]) assert.equal(repetivel(r), true, JSON.stringify(r));
  for (const r of [{ status: 400 }, { status: 403 }, { status: 404 }]) assert.equal(repetivel(r), false, JSON.stringify(r));
});

test("rodízio: cada rodada passa pelos servidores; espera crescente só antes de uma rodada nova", () => {
  assert.deepEqual(
    planoOverpass([A, B], 3, 1500).map((p) => [p.url, p.esperaAntesMs]),
    [[A, 0], [B, 0], [A, 1500], [B, 0], [A, 3000], [B, 0]],
  );
});

test("Retry-After: segundos ou data HTTP; vazio ou ilegível = null", () => {
  assert.equal(retryAfterMs("3"), 3000);
  assert.equal(retryAfterMs("Thu, 01 Jan 1970 00:00:10 GMT", 4000), 6000);
  assert.equal(retryAfterMs(null), null);
  assert.equal(retryAfterMs("depois"), null);
});

test("o primeiro servidor falha (429) → o segundo responde, sem esperar", async () => {
  const f = falso();
  const etapas: string[] = [];
  const r = await comRodizio(planoOverpass([A, B]), f.tentarCom([{ falha: { status: 429 }, retryAfterMs: 30_000 }, { ok: "lista" }]), etapas, ORCAMENTO_OVERPASS_MS, f.relogio);
  assert.equal(r, "lista");
  assert.deepEqual(f.pedidos.map((p) => p.url), [A, B]);
  assert.deepEqual(f.esperas, [], "o Retry-After do A não atrasa o B");
});

test("os dois falham na 1.ª rodada → espera e tenta a 2.ª rodada; responde na repetição", async () => {
  const f = falso();
  const r = await comRodizio(planoOverpass([A, B]), f.tentarCom([{ falha: { erro: "TimeoutError" } }, { falha: { status: 504 } }, { ok: "lista" }]), [], ORCAMENTO_OVERPASS_MS, f.relogio);
  assert.equal(r, "lista");
  assert.deepEqual(f.pedidos.map((p) => p.url), [A, B, A]);
  assert.deepEqual(f.esperas, [1500]);
});

test("Retry-After do servidor é respeitado quando é maior que a espera do plano e cabe no orçamento", async () => {
  const f = falso();
  await comRodizio(planoOverpass([A]), f.tentarCom([{ falha: { status: 429 }, retryAfterMs: 4000 }, { ok: "x" }]), [], ORCAMENTO_OVERPASS_MS, f.relogio);
  assert.deepEqual(f.esperas, [4000]);
});

test("400 tira aquele servidor da roda (não se repete o pedido errado)", async () => {
  const f = falso();
  const etapas: string[] = [];
  const r = await comRodizio(planoOverpass([A, B]), f.tentarCom([{ falha: { status: 400 } }, { falha: { status: 503 } }, { falha: { status: 503 } }]), etapas, ORCAMENTO_OVERPASS_MS, f.relogio);
  assert.equal(r, null);
  assert.deepEqual(f.pedidos.map((p) => p.url), [A, B, B]);
  assert.deepEqual(etapas, ["overpass:esgotado"]);
});

test("orçamento: nenhuma tentativa passa do tempo que resta; esgotado = null e a etapa diz 'esgotado' (falha honesta)", async () => {
  const f = falso(20_000); // cada tentativa gasta o tempo inteiro (tempo estourado)
  const etapas: string[] = [];
  const timeout = { falha: { erro: "TimeoutError" } as ResultadoTentativa };
  const r = await comRodizio(planoOverpass([A, B]), f.tentarCom([timeout, timeout, timeout, timeout]), etapas, 45_000, f.relogio);
  assert.equal(r, null);
  assert.deepEqual(f.pedidos.map((p) => p.tempoMs), [20_000, 20_000], "sobram 5 s: a espera de 1,5 s deixaria menos que o mínimo útil");
  assert.deepEqual(etapas, ["overpass:esgotado"]);
  assert.ok(f.relogio.agora() <= 45_000);
});

test("servidor: o Overpass usa o rodízio com orçamento; o Nominatim repete 429/5xx/tempo; o ponto que se GUARDA é só do OSM", () => {
  const s = ler("lib/proximidades/osm-servidor.ts");
  assert.match(s, /comRodizio<LugarProximo\[\]>\(\s*planoOverpass\(OVERPASS_SERVIDORES\)/);
  assert.match(s, /signal: AbortSignal\.timeout\(tempoMs\)/);
  assert.match(s, /for \(let t = 1; t <= TENTATIVAS_NOMINATIM; t\+\+\)/);
  const soOsm = s.slice(s.indexOf("export async function geocodificarEnderecoOsm"), s.indexOf("/** Ponto de um LUGAR"));
  assert.doesNotMatch(soOsm, /geocodeForSave|mapbox/i, "o ponto para guardar não recorre ao Mapbox");
});

test("rota: a perna do after() guarda ponto e lista do OSM (fonte 'osm'); sem ponto do OSM não grava; o Overpass com o orçamento do after", () => {
  const r = ler("app/api/proximidades/route.ts");
  const perna = r.slice(r.indexOf("after(async () => {"), r.lastIndexOf("return responder(aoVivo"));
  assert.match(perna, /const pontoOsm = fonte === "osm" \? ponto : await geocodificarEnderecoOsm\(endereco, etapasOsm\);/);
  assert.match(perna, /if \(!pontoOsm\) \{[\s\S]*?return;/);
  assert.match(perna, /buscarLugares\(pontoOsm, etapasOsm, ORCAMENTO_OVERPASS_MS\)/);
  for (const m of perna.matchAll(/upsert\(\{([^}]*)\}/g)) {
    assert.match(m[1], /lat: pontoOsm\.lat, lng: pontoOsm\.lng/, m[1]);
    assert.doesNotMatch(m[1], /fonte,|fonte: fonte|mapbox/i, m[1]);
  }
});
