/**
 * E446 (páginas): o título da cidade mostra o MESMO número e a mesma frase da busca; reais × exemplo só no detalhe.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contagemDaBusca } from "./busca/titulo-busca.ts";
import { detalheContagemCidade } from "./cidades.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("a cidade usa contagemDaBusca com o total da lista (mesmo número da busca)", () => {
  const pg = ler("app/(public)/cidades/[cidade]/page.tsx");
  assert.match(pg, /contagemDaBusca\(\{ n: properties\.length, local: name \}\)/);
  assert.doesNotMatch(pg, /tituloContagemCidade\(/);
  assert.equal(contagemDaBusca({ n: 15, local: "Uberlândia" }), "15 imóveis em Uberlândia");
  assert.match(ler("app/(public)/buscar/search-client.tsx"), /contagemDaBusca\(\{ n: results\.length/);
});

test("reais e exemplos aparecem no detalhe, sem mudar o número do título", () => {
  assert.equal(detalheContagemCidade(0, 0), null);
  assert.equal(detalheContagemCidade(9, 0), null);
  assert.match(detalheContagemCidade(0, 15) ?? "", /Todos são anúncios de exemplo/);
  assert.match(detalheContagemCidade(9, 6) ?? "", /9 são imóveis reais e 6 são de exemplo/);
  assert.match(detalheContagemCidade(1, 1) ?? "", /1 é um imóvel real e 1 é de exemplo/);
});

test("os bairros contam o mesmo conjunto (E446 da Pista B, #2691): nenhum bairro com imóvel diz 'sem imóveis'", () => {
  const pg = ler("app/(public)/cidades/[cidade]/page.tsx");
  assert.match(pg, /bairrosDaGrade\(cidade, properties, contaNaBusca\)/);
  assert.match(ler("components/cidades/bairro-pagina.tsx"), /const total = bairro\.imoveis\.length;/);
});
