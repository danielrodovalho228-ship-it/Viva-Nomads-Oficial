/* Roda: node --test src/lib/imovel/voltar-busca.test.ts — E207 (detalhe público sem migalhas; voltar só vindo da busca). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { destinoVoltarBusca, registroVoltarBusca } from "./voltar-busca.ts";

test("a busca grava o imóvel aberto e a URL com os filtros; o detalhe só volta para o MESMO imóvel", () => {
  const reg = registroVoltarBusca("/imoveis/ube-001", "/buscar?cidade=Uberl%C3%A2ndia&tipo=apartamento");
  assert.equal(destinoVoltarBusca(reg, "ube-001"), "/buscar?cidade=Uberl%C3%A2ndia&tipo=apartamento");
  assert.equal(destinoVoltarBusca(reg, "ube-002"), null, "outro imóvel: não mostra");
  assert.equal(destinoVoltarBusca(null, "ube-001"), null, "chegou direto: não mostra");
  assert.equal(registroVoltarBusca("/imoveis/ube-001", "/cidades/uberlandia"), null, "fora da busca: não grava");
  assert.equal(destinoVoltarBusca('{"id":"x","url":"//mal.com"}', "x"), null);
  assert.equal(destinoVoltarBusca("{quebrado", "x"), null);
});

test("o detalhe não tem migalhas visíveis; o BreadcrumbList (com a cidade) segue nos dados estruturados", () => {
  const tela = readFileSync("src/app/(public)/imoveis/[id]/property-detail.tsx", "utf8");
  assert.doesNotMatch(tela, /aria-label="Trilha de navegação"/);
  assert.match(tela, /data-testid="voltar-resultados"/);
  const jsonLd = readFileSync("src/components/seo/property-json-ld.tsx", "utf8");
  assert.match(jsonLd, /"@type": "BreadcrumbList"/);
  assert.match(jsonLd, /name: property\.city,/);
});
