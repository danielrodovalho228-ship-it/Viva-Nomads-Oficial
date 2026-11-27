/*
  E874 — /cidades redirecionava para Uberlândia (sem índice) e /cidades/sao-paulo dava 404 seco.
  Roda: node --test src/lib/e874-indice-cidades.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linhaIndiceCidade, municipiosDoSlug, nomeSemOperacao, slugDaCidade } from "./indice-cidades.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const MUNICIPIOS = JSON.parse(ler("data/municipios-ibge.json")) as Record<string, string[]>;
const indice = ler("app/(public)/cidades/page.tsx");
const cidade = ler("app/(public)/cidades/[cidade]/page.tsx");

test("o índice lista cada cidade com a contagem e o detalhe reais × exemplo (o mesmo da página da cidade)", () => {
  const c = { slug: "uberlandia", name: "Uberlândia", state: "MG" };
  assert.deepEqual(linhaIndiceCidade(c, 0, 15), { slug: "uberlandia", nome: "Uberlândia", uf: "MG", total: 15, rotulo: "15 imóveis", detalhe: "Todos são anúncios de exemplo (marcados em cada cartão)." });
  assert.equal(linhaIndiceCidade(c, 1, 0).rotulo, "1 imóvel");
  assert.equal(linhaIndiceCidade(c, 0, 0).rotulo, "Sem imóveis no momento");
  assert.equal(linhaIndiceCidade(c, 3, 0).detalhe, null);
});

test("/cidades é o índice de verdade (sem redirecionar), contado pela base da vitrine", () => {
  assert.doesNotMatch(indice, /permanentRedirect|redirect\(/);
  assert.match(indice, /CITIES\.map/);
  assert.match(indice, /baseDaVitrine\(await listPropertiesByCity\(c\.name\)/);
  assert.match(indice, /data-testid="indice-cidade"/);
  assert.match(indice, /href="\/pedidos\/novo"/);
});

test("cidade sem operação (município real) tem página própria; slug que não é cidade segue 404", () => {
  assert.equal(slugDaCidade("São Paulo"), "sao-paulo");
  assert.equal(slugDaCidade("Uberlândia"), "uberlandia");
  assert.deepEqual(municipiosDoSlug("sao-paulo", MUNICIPIOS), [{ cidade: "São Paulo", uf: "SP" }]);
  assert.equal(nomeSemOperacao(municipiosDoSlug("sao-paulo", MUNICIPIOS)), "São Paulo");
  assert.ok(municipiosDoSlug("bom-jesus", MUNICIPIOS).length > 1, "homônimos voltam todos");
  assert.deepEqual(municipiosDoSlug("xpto123", MUNICIPIOS), []);
  assert.deepEqual(municipiosDoSlug("../etc", MUNICIPIOS), []);
  assert.match(cidade, /if \(!s\) notFound\(\);\s*return <CidadeSemOperacao nome=\{s\.nome\} ufs=\{s\.ufs\} \/>;/);
  assert.match(cidade, /robots: \{ index: false, follow: true \}/);
  assert.match(cidade, /Ainda não operamos em \{nome\}/);
  assert.match(cidade, /\/pedidos\/novo\?cidade=\$\{encodeURIComponent\(nome\)\}/);
});
