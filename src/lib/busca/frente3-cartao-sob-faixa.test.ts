/*
  Frente 3 (mapa): o t839 a 390 px caiu com o E780 (ca92902af, 09/11). A faixa de filtros da busca no celular ficou presa
  abaixo do cabeçalho (div sticky), mas o "mostrar o cartão do pin na tela" só descontava header/nav como barras fixas:
  a página rolava o cartão para logo abaixo do cabeçalho e o "Fechar" (topo do cartão) ficava sob a faixa presa.
  Roda: node --test src/lib/busca/frente3-cartao-sob-faixa.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SELETOR_BARRAS_FIXAS, rolagemParaMostrar } from "./cartao-no-mapa.ts";

test("as barras fixas que o cartão do mapa respeita incluem quem se marca data-barra-fixa", () => {
  assert.match(SELETOR_BARRAS_FIXAS, /header/);
  assert.match(SELETOR_BARRAS_FIXAS, /nav/);
  assert.match(SELETOR_BARRAS_FIXAS, /\[data-barra-fixa\]/);
});

test("a faixa de filtros presa da busca (E780) se marca como barra fixa", () => {
  const busca = readFileSync("src/app/(public)/buscar/search-client.tsx", "utf8");
  const i = busca.indexOf('data-testid="busca-topo-fixo"');
  const tag = busca.slice(busca.lastIndexOf("<div", i), busca.indexOf(">", i));
  assert.match(tag, /data-barra-fixa/);
});

test("com a faixa presa somada ao topo livre, o cartão desce até ficar abaixo dela", () => {
  // Cabeçalho 72 px + faixa presa até 176 px: o cartão que começa em 100 px desce 84 px (176 + 8 − 100).
  assert.equal(rolagemParaMostrar({ top: 100, bottom: 400 }, 176, 800), 100 - 184);
  assert.equal(rolagemParaMostrar({ top: 100, bottom: 400 }, 72, 800), 0, "só com o cabeçalho, o cartão em 100 px já 'cabia' — era o defeito");
});
