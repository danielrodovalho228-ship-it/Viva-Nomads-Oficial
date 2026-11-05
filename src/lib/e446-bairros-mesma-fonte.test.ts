/*
  E446 — /cidades/uberlandia: a grade de bairros dizia "Sem imóveis no momento" em TODOS, e /cidades/uberlandia/
  santa-monica abria com "0 imóveis", enquanto a busca (e a lista da própria página da cidade) mostrava imóveis em
  Santa Mônica, Umuarama, Tibery, Jardim Karaíba, Centro, Brasil, Aparecida, Saraiva, Fundinho. Causa: a busca e a
  lista da cidade usam listProperties (reais + exemplos com a vitrine ligada), mas a contagem por bairro tirava os
  exemplos (isExemplo). Em produção (05/11) não há anúncio real público em Uberlândia, então tudo dava 0.
  Correção: a grade, a página do bairro e o total da cidade contam o MESMO conjunto da busca (contaNaBusca). O índice
  do Google segue só com anúncio real (a página de bairro só com exemplo continua noindex; sitemap inalterado).
  Roda: node --test src/lib/e446-bairros-mesma-fonte.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bairrosDaGrade, contaNaBusca, imoveisDoBairro } from "./bairros.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const ex = (id: string, bairro: string) => ({ id, neighborhood: bairro, lat: 0, lng: 0 });

test("o que a busca mostra (inclusive exemplo) conta no bairro: Santa Mônica 2, Umuarama 1", () => {
  const lista = [ex("ube-001", "Santa Mônica"), ex("ube-009", "Santa Mônica"), ex("ube-004", "Umuarama")];
  const g = bairrosDaGrade("uberlandia", lista, contaNaBusca);
  assert.equal(g.find((b) => b.slug === "santa-monica")?.total, 2);
  assert.equal(g.find((b) => b.slug === "umuarama")?.total, 1);
  assert.equal(imoveisDoBairro("santa-monica", lista, contaNaBusca).length, 2);
});

test("as páginas da cidade e do bairro contam pela mesma regra da busca", () => {
  const cidade = ler("app/(public)/cidades/[cidade]/page.tsx");
  assert.match(cidade, /bairrosDaGrade\(cidade, properties, contaNaBusca\)/);
  const polo = ler("app/(public)/cidades/[cidade]/[polo]/page.tsx");
  assert.match(polo, /imoveisDoBairro\(slug, await listPropertiesByCity\(cidadeNome\), contaNaBusca\)/);
  assert.match(polo, /bairrosDaGrade\(cidade, daCidade, contaNaBusca\)/);
  assert.match(polo, /totalCidade=\{daCidade\.length\}/);
  const pagina = ler("components/cidades/bairro-pagina.tsx");
  assert.match(pagina, /const total = bairro\.imoveis\.length;/);
  // O índice do Google segue só com anúncio real.
  assert.match(pagina, /const semImovel = b\.imoveis\.filter\(\(i\) => !isExemplo\(i\.id\)\)\.length === 0;/);
});
