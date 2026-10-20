/*
  Prompt 37 — busca pelo local de trabalho: regras puras, provedor (com fetch simulado) e privacidade da resposta.
  Roda: node --test src/lib/rotas/rotas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { arredondarMinutos, dentroDoLimite, faixaMinutos, rotuloLinhaReta, rotuloTempo, textoMinutos } from "./tempo.ts";
import { chavePonto, destinoDaUrl, destinoNaUrl, limparRotulo } from "./destino-url.ts";
import { COORDENADAS_POR_CHAMADA, LOTES_POR_HORA, MAIS_PROXIMOS, distanciaKm, emLotes, lotesMatrix, maisProximos } from "./selecao.ts";
import { CHAVES_ITEM_PUBLICO, montarResposta } from "./resposta.ts";
import { blocoTempoAte } from "./tempo-ate.ts";
import { configuracaoRotas, modosDisponiveis, partidaOnibus, provedorGoogleOnibus, provedorMapbox, provedorPara, ProvedorForaDoAr } from "../integrations/rotas.ts";

const HC = { lat: -18.9186, lng: -48.2567 };

test("rotuloTempo: arredonda para cima em múltiplos de 5, com o meio e o destino", () => {
  assert.equal(rotuloTempo({ minutos: 12.2, modo: "carro", destinoRotulo: "HC-UFU", artigo: "o" }), "~15 min de carro até o HC-UFU");
  assert.equal(rotuloTempo({ minutos: 15, modo: "carro", destinoRotulo: "HC-UFU", artigo: "o" }), "~15 min de carro até o HC-UFU");
  assert.equal(rotuloTempo({ minutos: 15.01, modo: "a_pe", destinoRotulo: "HC-UFU", artigo: "o" }), "~20 min a pé até o HC-UFU");
  assert.equal(rotuloTempo({ minutos: 4.9, modo: "bicicleta", destinoRotulo: "UFU Campus Umuarama", artigo: "a" }), "menos de 5 min de bicicleta até a UFU Campus Umuarama");
  assert.equal(rotuloTempo({ minutos: 0, modo: "onibus" }), "menos de 5 min de ônibus");
  assert.equal(rotuloTempo({ minutos: 5, modo: "onibus", destinoRotulo: "Av. Pará" }), "~5 min de ônibus até Av. Pará");
  // Nunca inventa minuto.
  assert.equal(rotuloTempo({ minutos: null, modo: "carro", destinoRotulo: "HC-UFU" }), "");
  assert.equal(rotuloTempo({ minutos: Number.NaN, modo: "carro" }), "");
  assert.equal(arredondarMinutos(-1), null);
  assert.equal(textoMinutos(31), "~35 min");
});

test("filtro 'até N min' e faixas de minutos usam o número arredondado da tela", () => {
  assert.equal(dentroDoLimite(18, 20), true);
  assert.equal(dentroDoLimite(20, 20), true);
  assert.equal(dentroDoLimite(20.5, 20), false);
  assert.equal(dentroDoLimite(null, 20), false);
  assert.equal(dentroDoLimite(null, 0), true);
  assert.deepEqual([3, 10, 11, 20, 29, 31, null].map(faixaMinutos), [0, 0, 1, 1, 2, 3, 4]);
});

test("linha reta: uma casa, vírgula e o rótulo 'em linha reta'", () => {
  assert.equal(rotuloLinhaReta(3.24), "≈ 3,2 km em linha reta");
  assert.equal(rotuloLinhaReta(0.01), "≈ 0,1 km em linha reta");
  assert.equal(rotuloLinhaReta(null), "");
});

test("os 40 mais próximos em linha reta vão para a Matrix (sem ponto fica de fora)", () => {
  const lista = Array.from({ length: 60 }, (_, i) => ({ id: `i${String(i).padStart(2, "0")}`, lat: HC.lat + (i + 1) * 0.001, lng: HC.lng }));
  lista.push({ id: "sem-ponto", lat: 0, lng: 0 });
  const r = maisProximos([...lista].reverse(), HC);
  assert.equal(MAIS_PROXIMOS, 40);
  assert.equal(r.length, 40);
  assert.deepEqual(r.map((p) => p.id), lista.slice(0, 40).map((p) => p.id));
  assert.ok(!r.some((p) => p.id === "sem-ponto"));
});

test("lotes de 25 coordenadas: destino + 24 imóveis por chamada", () => {
  assert.equal(COORDENADAS_POR_CHAMADA, 25);
  assert.deepEqual(emLotes([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  const imoveis = Array.from({ length: 50 }, (_, i) => ({ lat: -18.9 - i / 1000, lng: -48.2 }));
  const lotes = lotesMatrix(HC, imoveis);
  assert.deepEqual(lotes.map((l) => l.coordenadas.length), [25, 25, 3]);
  for (const l of lotes) assert.deepEqual(l.coordenadas[0], HC);
  assert.equal(LOTES_POR_HORA, 12); // 300 cálculos/hora ÷ 24 por lote
});

test("Mapbox Matrix: uma chamada por lote, fontes = imóveis, destino = 0, minutos e metros por imóvel", async () => {
  const chamadas: string[] = [];
  const busca = (async (url: string) => {
    chamadas.push(url);
    const coords = decodeURIComponent(url.split("/driving/")[1].split("?")[0]).split(";");
    const n = coords.length - 1;
    return new Response(JSON.stringify({ code: "Ok", durations: Array.from({ length: n }, (_, i) => [600 + i * 60]), distances: Array.from({ length: n }, () => [5000]) }), { status: 200 });
  }) as typeof fetch;
  const p = provedorMapbox({ base: "http://127.0.0.1:3998", token: "x" }, busca);
  const origens = Array.from({ length: 30 }, (_, i) => ({ lat: -18.9 - i / 1000, lng: -48.2 }));
  const r = await p.calcular(HC, origens, "carro");
  assert.equal(chamadas.length, 2);
  for (const u of chamadas) {
    assert.match(u, /\/directions-matrix\/v1\/mapbox\/driving\//);
    assert.match(u, /destinations=0/);
    assert.ok(decodeURIComponent(u.split("/driving/")[1].split("?")[0]).split(";").length <= 25);
  }
  assert.match(chamadas[0], /sources=1;2;3/);
  assert.equal(r.length, 30);
  assert.deepEqual(r[0], { minutos: 10, metros: 5000 });
  assert.deepEqual(r[24], { minutos: 10, metros: 5000 }); // 1º do 2º lote
});

test("provedor fora do ar (HTTP 503 ou rede) lança ProvedorForaDoAr — quem chama cai para a linha reta", async () => {
  const p503 = provedorMapbox({ base: "http://127.0.0.1:3998", token: "x" }, (async () => new Response("{}", { status: 503 })) as typeof fetch);
  await assert.rejects(p503.calcular(HC, [{ lat: -18.9, lng: -48.2 }], "a_pe"), ProvedorForaDoAr);
  const pRede = provedorMapbox({ base: "http://127.0.0.1:3998", token: "x" }, (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch);
  await assert.rejects(pRede.calcular(HC, [{ lat: -18.9, lng: -48.2 }], "bicicleta"), ProvedorForaDoAr);
});

test("sem token: nenhum meio com dado, nenhum provedor (a tela mostra só a linha reta)", () => {
  const cfg = configuracaoRotas({}, false);
  assert.deepEqual(cfg, { mapbox: null, google: null });
  assert.deepEqual(modosDisponiveis(cfg), []);
  assert.equal(provedorPara("carro", cfg), null);
  // A resposta, sem tempos, não traz minuto nenhum — só a linha reta.
  const r = montarResposta({
    modo: "carro",
    destino: { rotulo: "HC-UFU", artigo: "o", ponto: HC },
    fonte: "linha_reta",
    imoveis: [{ id: "a", lat: -18.93, lng: -48.26 }],
    tempos: new Map(),
    pendentes: new Set(),
  });
  assert.equal(r.itens[0].minutos, null);
  assert.equal(r.itens[0].texto, "");
  assert.match(r.itens[0].linhaReta, /^≈ \d+,\d km em linha reta$/);
});

test("ônibus: só com ROTAS_ONIBUS_ATIVO=1 E a chave; laboratório só aceita o provedor falso local", () => {
  assert.equal(configuracaoRotas({ GOOGLE_ROUTES_API_KEY: "k" }, false).google, null);
  assert.equal(configuracaoRotas({ ROTAS_ONIBUS_ATIVO: "1" }, false).google, null);
  assert.deepEqual(modosDisponiveis(configuracaoRotas({ ROTAS_ONIBUS_ATIVO: "1", GOOGLE_ROUTES_API_KEY: "k", NEXT_PUBLIC_MAPBOX_TOKEN: "t" }, false)), ["carro", "a_pe", "bicicleta", "onibus"]);
  // Laboratório: token de verdade é ignorado; só o falso em 127.0.0.1.
  assert.deepEqual(configuracaoRotas({ NEXT_PUBLIC_MAPBOX_TOKEN: "t" }, true), { mapbox: null, google: null });
  assert.equal(configuracaoRotas({ LAB_ROTAS_URL: "https://api.mapbox.com" }, true).mapbox, null);
  assert.deepEqual(configuracaoRotas({ LAB_ROTAS_URL: "http://127.0.0.1:3998" }, true).mapbox, { base: "http://127.0.0.1:3998", token: "lab" });
});

test("Google Routes (ônibus, resposta simulada): par sem linha volta null, nunca minuto inventado", async () => {
  let corpo: Record<string, unknown> = {};
  const busca = (async (_url: string, init?: RequestInit) => {
    corpo = JSON.parse(String(init?.body));
    assert.equal((init?.headers as Record<string, string>)["X-Goog-Api-Key"], "k");
    return new Response(
      JSON.stringify([
        { originIndex: 0, destinationIndex: 0, duration: "1500s", distanceMeters: 6200, condition: "ROUTE_EXISTS" },
        { originIndex: 1, destinationIndex: 0, condition: "ROUTE_NOT_FOUND" },
      ]),
      { status: 200 }
    );
  }) as typeof fetch;
  const p = provedorGoogleOnibus({ base: "http://127.0.0.1:3998", chave: "k" }, busca, () => new Date("2026-10-23T12:00:00Z"));
  const r = await p.calcular(HC, [{ lat: -18.9, lng: -48.2 }, { lat: -18.95, lng: -48.3 }], "onibus");
  assert.deepEqual(r, [{ minutos: 25, metros: 6200 }, null]);
  assert.equal(corpo.travelMode, "TRANSIT");
  // Sexta → partida na segunda às 07:30 de Brasília.
  assert.equal(corpo.departureTime, "2026-10-26T10:30:00.000Z");
  assert.equal(partidaOnibus(new Date("2026-10-20T12:00:00Z")), "2026-10-21T10:30:00.000Z");
});

test("URL compartilhável: no máximo 2 casas decimais e nunca número de casa", () => {
  const p = destinoNaUrl(new URLSearchParams("local=Uberlândia"), {
    ponto: { lat: -18.918634, lng: -48.256712, rotulo: "Av. Pará, 1720 - Umuarama, Uberlândia - MG, 38405-320, Brasil" },
    modo: "a_pe",
    ate: 20,
  });
  const qs = p.toString();
  assert.equal(p.get("dlat"), "-18.92");
  assert.equal(p.get("dlng"), "-48.26");
  assert.equal(p.get("drot"), "Av. Pará - Umuarama, Uberlândia - MG");
  assert.equal(p.get("local"), "Uberlândia");
  for (const v of [p.get("dlat")!, p.get("dlng")!]) assert.ok((v.split(".")[1] ?? "").length <= 2, v);
  assert.doesNotMatch(decodeURIComponent(qs), /1720|38405/);
  assert.equal(destinoNaUrl(new URLSearchParams(), { slug: "hc-ufu", modo: "carro", ate: 20 }).toString(), "destino=hc-ufu&ate=20");
  // Ler de volta: mesmo arredondamento, mesmo rótulo limpo — inclusive de uma URL "suja" colada à mão.
  const d = destinoDaUrl("dlat=-18.918634&dlng=-48.256712&drot=Rua%20das%20Flores%2C%20123%20apto%2045&modo=bicicleta&ate=15");
  assert.deepEqual(d, { ponto: { lat: -18.92, lng: -48.26, rotulo: "Rua das Flores" }, modo: "bicicleta", ate: 15 });
  assert.deepEqual(destinoDaUrl("destino=hc-ufu&modo=onibus&ate=30"), { slug: "hc-ufu", modo: "onibus", ate: 30 });
  assert.equal(destinoDaUrl("destino=HC UFU!"), null);
  assert.equal(destinoDaUrl("dlat=0&dlng=0"), null);
  assert.equal(destinoDaUrl("destino=hc-ufu&ate=17")?.ate, 0); // fora das opções = sem filtro
  assert.equal(limparRotulo("Rua 10, nº 55, Bloco B, Centro"), "Rua, Centro");
  assert.equal(chavePonto(-18.918634, -48.256712), "p:-18.919,-48.257");
});

test("privacidade: a resposta para o navegador nunca traz lat/lng do imóvel nem metros exatos", () => {
  const exato = { lat: -18.912345, lng: -48.271234 };
  const aproximado = { id: "11111111-1111-4111-8111-111111111111", lat: -18.913, lng: -48.27 };
  const r = montarResposta({
    modo: "carro",
    destino: { rotulo: "HC-UFU", artigo: "o", ponto: HC },
    fonte: "rotas",
    imoveis: [aproximado, { id: "33333333-3333-4333-8333-333333333333", lat: -18.95, lng: -48.3 }],
    tempos: new Map([
      [aproximado.id, { minutos: 13.37, metros: 4321 }],
      ["33333333-3333-4333-8333-333333333333", { minutos: 7.1, metros: 2229 }],
    ]),
    pendentes: new Set(),
  });
  const json = JSON.stringify(r);
  for (const item of r.itens) assert.deepEqual(Object.keys(item).sort(), [...CHAVES_ITEM_PUBLICO].sort());
  assert.doesNotMatch(json, /"lat"|"lng"|metros|4321|2229|13\.37|7\.1\b/);
  assert.doesNotMatch(json, new RegExp(String(exato.lat).replace(".", "\\.")));
  assert.deepEqual(r.itens.map((i) => [i.minutos, i.ordem]), [[15, 2], [10, 1]]);
  assert.equal(r.itens[0].texto, "~15 min de carro até o HC-UFU");
});

test("bloco 'Tempo até': meio sem dado não aparece; sem nenhum tempo, a linha reta", () => {
  const destino = { rotulo: "HC-UFU", artigo: "o" as const, ponto: HC, destino: { slug: "hc-ufu" } };
  const com = blocoTempoAte({ destino, imovelAproximado: { lat: -18.93, lng: -48.27 }, modos: ["carro", "a_pe"], minutos: { carro: 9, a_pe: null } });
  assert.deepEqual(com.tempos, [{ modo: "carro", rotuloModo: "Carro", texto: "~10 min" }]);
  assert.equal(com.titulo, "até o HC-UFU");
  assert.equal(com.linhaReta, "");
  const sem = blocoTempoAte({ destino, imovelAproximado: { lat: -18.93, lng: -48.27 }, modos: [], minutos: {} });
  assert.deepEqual(sem.tempos, []);
  assert.match(sem.linhaReta, /em linha reta$/);
  assert.ok(distanciaKm(HC, { lat: -18.93, lng: -48.27 }) > 1);
});
