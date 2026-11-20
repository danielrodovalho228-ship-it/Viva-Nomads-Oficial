/*
  E446 (reprovado no lote 2 de 06/11): páginas de cidade/bairro NÃO usavam a mesma fonte da busca — a cidade dizia "15 anúncios de
  exemplo" (Santa Mônica 2) enquanto a busca dizia "9 imóveis" (Santa Mônica 6): três números para o mesmo fato. A regra do
  conjunto que a vitrine mostra (com imóvel real, os exemplos saem; sem nenhum real, aparecem) é UMA só: baseDaVitrine.
  Busca (lista, pílulas, facetas), grade de bairros, página do bairro e total da cidade leem a MESMA base.
  Roda: node --test src/lib/busca/contagem-vitrine.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { baseDaVitrine, bairrosDaVitrine, totalDaVitrine } from "./contagem-vitrine.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
const ehExemplo = (x: { id: string }) => x.id.startsWith("demo-");
const im = (id: string, neighborhood: string) => ({ id, neighborhood, city: "Uberlândia" });

test("com imóvel real, os exemplos saem de TODA contagem; sem nenhum real, os exemplos aparecem (a regra da busca)", () => {
  const mistos = [im("a", "Santa Mônica"), im("b", "Santa Mônica"), im("demo-1", "Santa Mônica"), im("demo-2", "Umuarama"), im("demo-3", "Martins")];
  const base = baseDaVitrine(mistos, ehExemplo);
  assert.deepEqual(base.map((x) => x.id), ["a", "b"]);
  assert.equal(totalDaVitrine(base), 2);
  const soExemplos = [im("demo-1", "Santa Mônica"), im("demo-2", "Umuarama")];
  assert.equal(totalDaVitrine(baseDaVitrine(soExemplos, ehExemplo)), 2);
  // ?exemplos=1 (lab/QA) mantém tudo, como na busca.
  assert.equal(totalDaVitrine(baseDaVitrine(mistos, ehExemplo, true)), 5);
});

test("a grade de bairros soma exatamente o total da cidade (um número só para o mesmo fato)", () => {
  const base = baseDaVitrine([im("a", "Santa Mônica"), im("b", "Santa Mônica"), im("c", "Umuarama"), im("demo-1", "Martins")], ehExemplo);
  const grade = bairrosDaVitrine(base);
  assert.deepEqual(grade.map((b) => [b.nome, b.total]), [["Santa Mônica", 2], ["Umuarama", 1]]);
  assert.equal(grade.reduce((s, b) => s + b.total, 0), totalDaVitrine(base));
});

test("as superfícies leem a mesma base: busca, cidade, grade de bairros e página do bairro", () => {
  const busca = ler("../../app/(public)/buscar/search-client.tsx");
  assert.match(busca, /baseDaVitrine\(base, \(p\) => isExemplo\(p\.id\), exemplosForcados\)/);
  const cidade = ler("../../app/(public)/cidades/[cidade]/page.tsx");
  assert.match(cidade, /const properties = baseDaVitrine\(await listPropertiesByCity\(name\), \(p\) => isExemplo\(p\.id\)\);/);
  assert.match(cidade, /bairrosDaGrade\(cidade, properties, contaNaBusca\)/);
  const polo = ler("../../app/(public)/cidades/[cidade]/[polo]/page.tsx");
  assert.match(polo, /baseDaVitrine\(await listPropertiesByCity\(cidadeNome\), \(p\) => isExemplo\(p\.id\)\)/);
  assert.match(polo, /const daCidade = baseDaVitrine\(await listPropertiesByCity\(c\.name\), \(p\) => isExemplo\(p\.id\)\);/);
  assert.match(polo, /totalCidade=\{daCidade\.length\}/);
});
