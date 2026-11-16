/*
  E978 (Alta) — "O que tem por perto" não responde em produção: a tela mostra só as referências da cidade com "A busca do
  mapa não respondeu agora", de forma reproduzível. Dois defeitos no código (sem depender dos logs):
   1. a resposta escondia QUAL etapa falhou — erro (Overpass), limite (30/dia) e sem_ponto (geocodificação) viravam
      todos "ancoras". Agora o motivo e as etapas (só códigos) vão na resposta ao dono;
   2. a falha se alimentava: com o Overpass fora, o ponto do CEP ficava no cache com lista vazia, e cada nova tentativa
      geocodificava o mesmo CEP de novo e gastava o limite do dia → o "erro" virava "limite" no mesmo dia. Agora o ponto
      do cache é reusado.
  Roda: node --test src/lib/proximidades/e978-motivo-da-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { respostaPerto } from "./ancoras.ts";

const ancora = { tipo: "universidade", categoria: "educacao", nome: "Universidade Federal de Uberlândia - Campus Santa Mônica", distanciaM: 999, lat: -18.9172, lng: -48.2585 } as never;
const farmacia = { tipo: "farmacia", categoria: "saude", nome: "Farmácia X", distanciaM: 50, lat: -18.9145, lng: -48.262 } as never;
const ref = { lat: -18.9146, lng: -48.2621 };

test("E978 — mapa fora com âncoras: fonte 'ancoras' e o motivo real da falha (erro, limite, sem_ponto)", () => {
  for (const motivo of ["erro", "limite", "sem_ponto"]) {
    const r = respostaPerto({ osm: null, fonteOsm: motivo, referencia: ref, ancoras: [ancora] });
    assert.equal(r.fonte, "ancoras");
    assert.equal(r.motivo, motivo);
  }
});

test("E978 — mapa fora sem âncoras: a fonte é a falha e o motivo também; mapa ok: sem motivo", () => {
  assert.deepEqual(respostaPerto({ osm: null, fonteOsm: "limite", referencia: ref, ancoras: [] }), { itens: [], fonte: "limite", motivo: "limite" });
  const ok = respostaPerto({ osm: [farmacia], fonteOsm: "osm", referencia: ref, ancoras: [ancora] });
  assert.equal(ok.fonte, "osm");
  assert.equal("motivo" in ok, false);
});

test("E978 — a rota devolve as etapas (só códigos) na falha e reusa o ponto do CEP do cache em vez de geocodificar de novo", () => {
  const s = readFileSync("src/app/api/proximidades/route.ts", "utf8");
  assert.match(s, /\.\.\.\(r\.motivo \? \{ etapas: etapas\.slice\(0, 12\) \} : \{\}\)/);
  assert.match(s, /const \{ ponto, fonte \} = pontoCache \? \{ ponto: pontoCache, fonte: "osm" as const \} : await geocodificarEndereco\(endereco, etapas\);/);
  // As etapas nunca carregam endereço nem CEP: só "serviço:código" (osm-servidor.ts).
  const o = readFileSync("src/lib/proximidades/osm-servidor.ts", "utf8");
  for (const m of o.matchAll(/etapas\.push\(([^)]*)\)/g)) assert.doesNotMatch(m[1], /cep|rua|endereco|lat|lng/i, m[1]);
});
