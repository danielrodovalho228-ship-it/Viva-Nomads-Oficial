/*
  E523 — filtro Local "A pé + Até 15 min" ignorado: com destino HC-UFU, os 2 resultados (≈3,9 km e ≈4,3 km em linha
  reta) ficavam. Sem tempo de rota o "até N min" não era aplicado. Agora a linha reta é um piso da rota: sai quem nem
  na velocidade máxima do modo chegaria no tempo. Roda: node --test src/lib/rotas/e523-ate-pela-reta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { foraDoTempoPelaReta, VELOCIDADE_MAX_KMH } from "./tempo.ts";

test("o caso do QA: 15 min a pé não alcança 3,9 km nem 4,3 km", () => {
  assert.equal(foraDoTempoPelaReta(3900, "a_pe", 15), true);
  assert.equal(foraDoTempoPelaReta(4300, "a_pe", 15), true);
  // 15 min a pé, a 6 km/h no máximo: até 1,5 km pode ficar (o tempo de rota decide depois).
  assert.equal(foraDoTempoPelaReta(1400, "a_pe", 15), false);
  assert.equal(foraDoTempoPelaReta(1600, "a_pe", 15), true);
});

test("outros modos: o mesmo raciocínio com a velocidade máxima de cada um", () => {
  assert.equal(foraDoTempoPelaReta(3900, "carro", 15), false); // 80 km/h × 15 min = 20 km
  assert.equal(foraDoTempoPelaReta(3900, "bicicleta", 10), true); // 20 km/h × 10 min ≈ 3,3 km
  assert.equal(foraDoTempoPelaReta(3900, "onibus", 15), false);
  assert.ok(VELOCIDADE_MAX_KMH.a_pe < VELOCIDADE_MAX_KMH.bicicleta && VELOCIDADE_MAX_KMH.bicicleta < VELOCIDADE_MAX_KMH.carro);
});

test("sem distância ou sem limite: não decide (ninguém some sem motivo)", () => {
  assert.equal(foraDoTempoPelaReta(null, "a_pe", 15), false);
  assert.equal(foraDoTempoPelaReta(undefined, "a_pe", 15), false);
  assert.equal(foraDoTempoPelaReta(5000, "a_pe", 0), false);
});

test("busca: sem tempo de rota (linha reta), o limite passa a valer pela distância do cartão", () => {
  const s = readFileSync(new URL("../../app/(public)/buscar/search-client.tsx", import.meta.url), "utf8");
  assert.match(s, /else if \(estadoDestino\.ate\) list = list\.filter\(\(p\) => !foraDoTempoPelaReta\(distanciaAte\(p, alvoDestino\)\?\.metros, estadoDestino\.modo, estadoDestino\.ate\)\);/);
});
