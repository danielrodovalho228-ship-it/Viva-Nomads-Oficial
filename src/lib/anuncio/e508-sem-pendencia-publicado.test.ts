/*
  E508 (QA de cliques do proprietário 02/11, D-S2-04): anúncios ATIVOS "Disponível agora" exibiam a pendência
  "Informar o tipo de entrada" em Meus imóveis (a dica do topo contava "8 publicados": 2 no ar e 6 pausados sem o campo).
  Anúncio publicado não carrega pendência de cadastro: a dica do topo e o link no cartão saem da lista. O tipo de entrada
  segue obrigatório para PUBLICAR anúncio novo (prontidão do rascunho) e o editor do publicado mantém a ajuda no campo.
  Roda: node --test src/lib/anuncio/e508-sem-pendencia-publicado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prontidaoAnuncio, type FatosAnuncio } from "./prontidao.ts";

const pagina = readFileSync("src/app/(dashboard)/dashboard/imoveis/page.tsx", "utf8");
const cartoes = readFileSync("src/app/(dashboard)/dashboard/imoveis/imoveis-client.tsx", "utf8");

test("Meus imóveis: anúncio publicado sem pendência de tipo de entrada (nem dica no topo, nem link no cartão)", () => {
  assert.doesNotMatch(pagina, /aviso-tipo-entrada/);
  assert.doesNotMatch(pagina, /semTipoEntrada/);
  assert.doesNotMatch(cartoes, /card-tipo-entrada/);
  assert.doesNotMatch(cartoes, /Informar o tipo de entrada/);
});

test("o rascunho continua exigindo o tipo de entrada para publicar (a regra do anúncio novo não muda)", () => {
  const base: FatosAnuncio = {
    enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 8, titulo: "Casa", preco: 1000, garantiaOk: true,
    sublocacaoOk: true, privacidadeOk: true, documento: "approved", descricao: "x".repeat(80), selo: false, video: false,
  };
  assert.equal(prontidaoAnuncio({ ...base, tipoEntradaOk: false }).podePublicar, false);
  assert.equal(prontidaoAnuncio({ ...base, tipoEntradaOk: true }).podePublicar, true);
});
