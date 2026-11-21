/*
  E869 (Phoenix RELATORIO-020, A-92/A-97): (1) parâmetros desconhecidos ou errados no link da busca (?pets=1, ?trabalho=1,
  ?garagem=1, ?comod=maquina) ficavam na URL sem filtrar e sem aviso — o link compartilhado mostrava os 15 como se filtrasse;
  (2) "Aceita negociação · 0" e "Emite nota fiscal · 0" apareciam no painel, desativados, sem nenhum anúncio no catálogo.
  Regras: o link é lido, o que a busca não conhece SAI da URL e vira um aviso nomeando o que foi ignorado; `cidade` (que os
  nossos e-mails mandam) é lido como `local`; o interruptor que nenhum anúncio do catálogo tem não é desenhado (o que só zera
  na combinação atual segue desativado — regra do E42).
  Roda: node --test src/lib/busca/e869-filtros-que-nao-filtram.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avisoLinkIgnorado, lerLinkDaBusca } from "./link-da-busca.ts";
import { interruptorSemAnuncio } from "./facetas.ts";
import { FILTROS_PAINEL_VAZIOS } from "./painel-filtros.ts";

test("parâmetros desconhecidos saem do link e são nomeados; os conhecidos ficam", () => {
  const r = lerLinkDaBusca(new URLSearchParams("pets=1&trabalho=1&garagem=1&pet=1&preco=3000&utm_source=x"));
  assert.deepEqual(r.ignorados, ["pets", "trabalho", "garagem"]);
  assert.equal(r.limpo.get("pet"), "1");
  assert.equal(r.limpo.get("preco"), "3000");
  assert.equal(r.limpo.get("utm_source"), "x", "rastreio de campanha não é filtro: fica");
  for (const k of ["pets", "trabalho", "garagem"]) assert.equal(r.limpo.has(k), false, k);
});

test("comodidade inexistente sai da lista e é nomeada; as válidas ficam", () => {
  const r = lerLinkDaBusca(new URLSearchParams("comod=maquina,garagem"));
  assert.deepEqual(r.ignorados, ["comod=maquina"]);
  assert.equal(r.limpo.get("comod"), "garagem");
  const so = lerLinkDaBusca(new URLSearchParams("comod=maquina"));
  assert.equal(so.limpo.has("comod"), false);
});

test("`cidade` (links dos nossos e-mails) vira `local`, sem aviso", () => {
  const r = lerLinkDaBusca(new URLSearchParams("cidade=Uberl%C3%A2ndia"));
  assert.deepEqual(r.ignorados, []);
  assert.equal(r.limpo.get("local"), "Uberlândia");
  assert.equal(r.limpo.has("cidade"), false);
});

test("link limpo não gera aviso; com ignorados, o aviso diz o que foi ignorado", () => {
  assert.deepEqual(lerLinkDaBusca(new URLSearchParams("local=Uberl%C3%A2ndia&pet=1&homeoffice=1&ate=10&modo=carro&destino=hc-ufu")).ignorados, []);
  assert.equal(avisoLinkIgnorado([]), null);
  assert.match(avisoLinkIgnorado(["pets"])!, /“pets”/);
  assert.match(avisoLinkIgnorado(["pets", "trabalho"])!, /foram ignorados/);
});

test("interruptor sem nenhum anúncio no catálogo não aparece; o ligado aparece sempre", () => {
  const contar = (f: typeof FILTROS_PAINEL_VAZIOS) => (f.negociaOnly ? 0 : f.petsOnly ? 3 : 15);
  assert.equal(interruptorSemAnuncio(contar, FILTROS_PAINEL_VAZIOS, "negociaOnly"), true);
  assert.equal(interruptorSemAnuncio(contar, FILTROS_PAINEL_VAZIOS, "petsOnly"), false);
  assert.equal(interruptorSemAnuncio(contar, { ...FILTROS_PAINEL_VAZIOS, negociaOnly: true }, "negociaOnly"), false);
});

test("a busca usa a leitura do link e o painel esconde os interruptores sem anúncio", () => {
  const cli = readFileSync(new URL("../../app/(public)/buscar/search-client.tsx", import.meta.url), "utf8");
  assert.match(cli, /lerLinkDaBusca\(/);
  assert.match(cli, /data-testid="busca-aviso-link"/);
  const painel = readFileSync(new URL("../../components/busca/painel-filtros-celular.tsx", import.meta.url), "utf8");
  for (const k of ["negociaOnly", "notaOnly", "precoJustoOnly", "gestorOnly"]) assert.match(painel, new RegExp(`interruptorSemAnuncio\\(contar, rascunho, "${k}"\\)`), k);
});
