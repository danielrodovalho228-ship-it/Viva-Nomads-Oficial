/*
  E419 (01/11): o mapa do anúncio falhou ao carregar. Causa: sem NEXT_PUBLIC_CARTO_API_KEY o Leaflet fica sem camada
  de mapa (cinza vazio) e, com mapbox, erro de rede/token deixava o quadro em branco sem aviso. Agora há um estado de
  erro único ("Não foi possível carregar o mapa agora.") para: sem chave, tiles que não chegam, erro/prazo do mapbox e
  o próprio script do mapa que não baixou.
  Roda: node --test src/components/e419-mapa-erro.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mapa = readFileSync(new URL("./property-map.tsx", import.meta.url), "utf8");
const lazy = readFileSync(new URL("./property-map-lazy.tsx", import.meta.url), "utf8");

test("E419: aviso único de mapa indisponível, com role=status e testid", () => {
  assert.match(mapa, /export const TEXTO_MAPA_INDISPONIVEL = "Não foi possível carregar o mapa agora\."/);
  assert.match(mapa, /export function MapaIndisponivel\(/);
  assert.match(mapa, /role="status"[\s\S]{0,200}data-testid="mapa-indisponivel"|data-testid="mapa-indisponivel"[\s\S]{0,200}role="status"/);
  assert.match(mapa, /A localização aproximada continua descrita nesta página\./);
});

test("E419: sem chave CARTO o quadro do mapa mostra o aviso (não um cinza vazio)", () => {
  assert.match(mapa, /data-mapa-base=\{TILES_CARTO \? "carto" : "sem-chave"\}/);
  assert.match(mapa, /\{!TILES_CARTO && \([\s\S]{0,200}<MapaIndisponivel/);
});

test("E419: falha ou prazo do mapa vira o aviso com 'Tentar de novo'", () => {
  assert.match(mapa, /const PRAZO_MAPA_MS = 12_000;/);
  assert.match(mapa, /map\.on\("error"/);
  assert.match(mapa, /esgotados >= 4\) aoFalharRef\.current\(\)/);
  assert.match(mapa, /if \(falhou\) return <MapaIndisponivel[^>]*aoTentar=/);
  assert.match(mapa, /data-testid="mapa-tentar-de-novo"/);
  // O prazo é limpo na desmontagem (sem aviso fantasma ao sair da página).
  assert.match(mapa, /clearTimeout\(prazo/);
});

test("E419: script do mapa que não baixa cai no aviso, não derruba a página", () => {
  assert.match(lazy, /\.catch\(\(\) => MapaNaoCarregou\)/);
  assert.match(lazy, /data-testid="mapa-indisponivel"/);
  assert.doesNotMatch(lazy + mapa, /window\.(alert|confirm)\(/);
});

test("E419: vocabulário — nada de hóspede/reserva/check-in nos avisos", () => {
  assert.doesNotMatch(mapa + lazy, /hóspede|reserva|check-in|temporada/i);
});
