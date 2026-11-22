/*
  E507 (família do E498, QA de cliques do proprietário 02/11) — "Continuar editando" do MESMO rascunho abria no Passo 4
  vindo da lista (Meus imóveis: o passo guardado no rascunho) e no Passo 3 vindo do Início (o 1º item que falta), com um
  % diferente do cartão. Correção: um destino só de retomada (hrefRetomarRascunho, da mesma prontidão que dá o % e a
  lista) — Início e Meus imóveis abrem no MESMO passo, com o MESMO número.
  Roda: node --test src/lib/anuncio/e507-retomar-rascunho.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checklistAnuncio, hrefRetomarRascunho, prontidaoAnuncio, type FatosAnuncio } from "./prontidao.ts";
import { ETAPA } from "./etapas-ids.ts";

const fatos = (o: Partial<FatosAnuncio> = {}): FatosAnuncio => ({
  enderecoOk: true,
  detalhesOk: false,
  periodoOk: true,
  fotos: 8,
  titulo: "",
  preco: 0,
  garantiaOk: false,
  sublocacaoOk: true,
  privacidadeOk: true,
  documento: "pending",
  descricao: "",
  selo: false,
  video: false,
  ...o,
});

test("retomar abre no 1º passo que falta (o mesmo item que o Início mostra como próximo)", () => {
  const p = prontidaoAnuncio(fatos());
  assert.equal(hrefRetomarRascunho(p, "r1"), `/dashboard/imoveis/novo?draft=r1&etapa=${ETAPA.detalhes}`);
  assert.equal(hrefRetomarRascunho(p, "r1"), checklistAnuncio(p, "r1").proximo?.href);
});

test("sem a prontidão lida, retomar abre o rascunho no assistente (sem passo inventado)", () => {
  assert.equal(hrefRetomarRascunho(null, "r1"), "/dashboard/imoveis/novo?draft=r1");
});

test("com tudo cumprido, retomar abre na Revisão", () => {
  const p = prontidaoAnuncio(fatos({ detalhesOk: true, titulo: "Casa boa", descricao: "x".repeat(80), preco: 2000, garantiaOk: true, documento: "approved" }));
  assert.equal(p.podePublicar, true);
  assert.equal(hrefRetomarRascunho(p, "r1"), `/dashboard/imoveis/novo?draft=r1&etapa=${ETAPA.revisao}`);
});

test("Meus imóveis e o Início usam o mesmo destino de retomada", () => {
  const lista = readFileSync("src/app/(dashboard)/dashboard/imoveis/imoveis-client.tsx", "utf8");
  assert.match(lista, /hrefRetomarRascunho\(prontidao\[p\.id\], p\.id\)/);
  const inicio = readFileSync("src/lib/painel/inicio-dono.ts", "utf8");
  assert.match(inicio, /botao: \{ rotulo: "Continuar de onde parou", href: r\.retomar \?\? /);
  const pagina = readFileSync("src/app/(dashboard)/dashboard/inicio-dados.tsx", "utf8");
  assert.match(pagina, /retomar: hrefRetomarRascunho\(/);
});
