import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  chaveDestino,
  comArtigo,
  dentroDoTempo,
  emLotes,
  escolherCandidatos,
  faixaMinutos,
  minutosArredondados,
  pontoDaUrl,
  pontoParaUrl,
  rotuloLimpo,
  rotuloReta,
  rotuloTempo,
} from "./tempo.ts";

test("rotuloTempo: múltiplos de 5 para cima; abaixo de 5, 'menos de 5 min'", () => {
  assert.equal(rotuloTempo({ minutos: 12.2, modo: "carro", destinoRotulo: comArtigo("HC-UFU", "o") }), "~15 min de carro até o HC-UFU");
  assert.equal(rotuloTempo({ minutos: 15, modo: "carro", destinoRotulo: "o HC-UFU" }), "~15 min de carro até o HC-UFU");
  assert.equal(rotuloTempo({ minutos: 15.1, modo: "a_pe" }), "~20 min a pé");
  assert.equal(rotuloTempo({ minutos: 4.9, modo: "bicicleta", destinoRotulo: "a UFU — Campus Umuarama" }), "menos de 5 min de bicicleta até a UFU — Campus Umuarama");
  assert.equal(rotuloTempo({ minutos: 41, modo: "onibus" }), "~45 min de ônibus");
  assert.equal(minutosArredondados(5), 5);
  assert.equal(minutosArredondados(0), null);
});

test("linha reta: dita como tal, nunca como minutos", () => {
  assert.equal(rotuloReta(3210), "≈ 3,2 km em linha reta");
  assert.equal(rotuloReta(760, "o HC-UFU"), "≈ 800 m em linha reta até o HC-UFU");
  assert.doesNotMatch(rotuloReta(12000), /min/);
});

test("faixas de minutos e filtro 'até' pelo tempo que a pessoa vê", () => {
  assert.deepEqual([10, 11, 20, 30, 31, null].map(faixaMinutos), [0, 1, 1, 2, 3, 4]);
  assert.equal(dentroDoTempo(19.5, 20), true);
  assert.equal(dentroDoTempo(20.5, 20), false, "aparece como ~25 min: fora do 'até 20'");
  assert.equal(dentroDoTempo(3, 10), true);
});

test("só os 40 mais próximos em linha reta vão à Matrix", () => {
  const destino = { lat: -18.88, lng: -48.26 };
  const itens = Array.from({ length: 100 }, (_, i) => ({ id: `p${i}`, lat: -18.88 - i * 0.001, lng: -48.26 }));
  const embaralhados = [...itens].reverse();
  const c = escolherCandidatos(embaralhados, destino);
  assert.equal(c.length, 40);
  assert.deepEqual(c.map((x) => x.id), itens.slice(0, 40).map((x) => x.id));
});

test("lotes de 25 coordenadas por chamada (1 destino + 24 imóveis)", () => {
  const lotes = emLotes(Array.from({ length: 50 }, (_, i) => i));
  assert.deepEqual(lotes.map((l) => l.length), [24, 24, 2]);
  assert.ok(lotes.every((l) => l.length + 1 <= 25));
  assert.deepEqual(emLotes([]), []);
});

test("URL: ponto com no máximo 2 casas; rótulo sem número de casa nem CEP", () => {
  assert.deepEqual(pontoParaUrl({ lat: -18.918734, lng: -48.259876 }), { dlat: "-18.92", dlng: "-48.26" });
  assert.deepEqual(pontoDaUrl("-18.918734", "-48.259876"), { lat: -18.92, lng: -48.26 });
  assert.equal(pontoDaUrl("abc", "1"), null);
  assert.equal(pontoDaUrl("95", "1"), null);
  for (const p of [pontoDaUrl("-18.9187", "-48.2598")!, pontoDaUrl("-18.9", "-48.26")!]) {
    assert.ok(String(p.lat).split(".")[1]?.length ?? 0 <= 2);
    assert.ok((String(p.lng).split(".")[1]?.length ?? 0) <= 2);
  }
  assert.equal(rotuloLimpo("Av. Pará, 1720 - Umuarama, Uberlândia - MG, 38405-320, Brasil"), "Av. Pará, Umuarama, Uberlândia - MG");
  assert.equal(rotuloLimpo("Rua Tito Teixeira nº 45, Santa Mônica"), "Rua Tito Teixeira, Santa Mônica");
  assert.doesNotMatch(rotuloLimpo("Rua 10, 233, Centro"), /233/);
});

test("chave do cache: id do destino ou ponto a 3 casas", () => {
  assert.equal(chaveDestino({ destinoId: "abc" }), "d:abc");
  assert.equal(chaveDestino({ lat: -18.91874, lng: -48.25999 }), "p:-18.919,-48.260");
});

test("GUARDA: o módulo de tempo é puro (nada de rede, banco ou window)", () => {
  const src = readFileSync(new URL("./tempo.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /fetch\(|supabase|window\.|process\.env/);
});
