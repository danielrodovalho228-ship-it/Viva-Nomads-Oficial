/*
  E79 — a distância até o destino ativo sempre visível (cartão e página do imóvel); linha reta enquanto não há rota.
  Roda: node --test src/lib/busca/distancia-destino.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { distanciaAte, ordenarPorDestino, pontoDoDestino, textoDoCartao } from "./distancia-destino.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const ANCORAS = [{ slug: "hc-ufu", nome: "HC-UFU", artigo: "o" as const, lat: -18.9186, lng: -48.2772 }];

test("local pessoal ativo: o km em linha reta, dito como tal, nunca minutos", () => {
  const alvo = pontoDoDestino({ lat: -18.92, lng: -48.26, rot: "Cargill, Distrito Industrial" }, ANCORAS);
  const d = distanciaAte({ lat: -18.93, lng: -48.27 }, alvo);
  assert.ok(d);
  assert.match(d.texto, /^≈ 1,5 km em linha reta até Cargill, Distrito Industrial$/);
  assert.doesNotMatch(d.texto, /min/);
});

test("âncora oficial ativa: o ponto cadastrado e o rótulo com artigo", () => {
  const alvo = pontoDoDestino({ slug: "hc-ufu" }, ANCORAS);
  assert.equal(alvo?.rotulo, "o HC-UFU");
  assert.match(distanciaAte({ lat: -18.9186, lng: -48.2872 }, alvo)!.texto, /≈ 1,1 km em linha reta até o HC-UFU/);
  assert.equal(pontoDoDestino({ slug: "sem-ponto" }, ANCORAS), null);
});

test("o cartão nunca fica em 'calculando…' depois de calcular: servidor, senão linha reta daqui", () => {
  const local = { texto: "≈ 800 m em linha reta até X", metros: 800 };
  assert.equal(textoDoCartao("~10 min de carro até X", local, false), "~10 min de carro até X");
  assert.equal(textoDoCartao(undefined, local, false), local.texto, "servidor sem o imóvel (exemplo): mostra o km");
  assert.equal(textoDoCartao(undefined, null, true), "calculando…");
  assert.equal(textoDoCartao(undefined, null, false), null, "sem ponto: sem linha");
});

test("ordem 'Mais perto do trabalho' pelo mesmo valor: posição do servidor, depois a distância", () => {
  const lista = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const pos = (id: string) => ({ c: 0, a: 1 } as Record<string, number>)[id];
  const metros = (p: { id: string }) => ({ b: 3000, d: 500 } as Record<string, number>)[p.id] ?? null;
  assert.deepEqual(ordenarPorDestino(lista, pos, metros).map((p) => p.id), ["c", "a", "d", "b"]);
});

test("a busca usa o mesmo cálculo no cartão e na ordem, e leva o destino à página do imóvel", () => {
  const busca = ler("src/app/(public)/buscar/search-client.tsx");
  assert.match(busca, /textoDoCartao\(tempos\.get\(p\.id\)\?\.texto, distanciaAte\(p, alvoDestino\), calculandoTempos\)/);
  assert.match(busca, /ordenarPorDestino\(list, \(id\) => tempos\.get\(id\)\?\.pos, \(p\) => distanciaAte\(p, alvoDestino\)\?\.metros \?\? null\)/);
  assert.match(busca, /guardarDestinoDaBusca\(estadoDestino\.destino, estadoDestino\.modo, alvoDestino\)/);
  const bloco = ler("src/components/property/tempo-ate.tsx");
  assert.match(bloco, /lerDestinoDaBusca\(\)/);
  assert.match(bloco, /distanciaAte\(ponto, sessao\.alvo\)/);
  // O servidor segue nunca devolvendo coordenada do imóvel; a âncora (lugar público) leva o ponto à busca.
  assert.match(ler("src/lib/data/tempos.ts"), /\.select\("id, slug, nome, artigo, tipo, cidade, uf, lat, lng"\)/);
});
