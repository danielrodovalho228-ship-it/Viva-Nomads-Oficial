import test from "node:test";
import assert from "node:assert/strict";
import { SAMPLE_PROPERTIES } from "../properties.ts";
import { descricaoAbaImovel } from "../anuncio/metadados-imovel.ts";
import { POLOS } from "../polos.ts";
import { LIMITE_META, limitarMeta, descricaoHome, descricaoPolo, descricaoBairro } from "./meta-descricao.ts";

// Ordem 49c2dbef (achado f6600ae4 do Moacir no #741): toda description GERADA cabe em 155 caracteres.
const NOMES_LONGOS = ["Jardim Umuarama", "Bairro Residencial Integração Santa Mônica do Sul Industrial", "Parque Granada Industrial II"];
const CIDADES_LONGAS = ["Uberlândia", "Governador Valadares", "Campos dos Goytacazes"];

test("limitarMeta: não mexe no que cabe; corta em palavra inteira e termina em reticências", () => {
  assert.equal(limitarMeta("Texto curto."), "Texto curto.");
  const longo = "palavra ".repeat(40).trim();
  const r = limitarMeta(longo);
  assert.ok(r.length <= LIMITE_META, String(r.length));
  assert.ok(r.endsWith("…"));
  assert.doesNotMatch(r, /palav…$/);
});

test("descrição da home cabe em 155 caracteres e mantém '30 a 180 dias'", () => {
  assert.ok(descricaoHome().length <= LIMITE_META, String(descricaoHome().length));
  assert.match(descricaoHome(), /30 a 180 dias/);
});

test("descrição dos polos cabe em 155 caracteres, com cidade de nome longo", () => {
  for (const p of POLOS) {
    for (const cidade of CIDADES_LONGAS) {
      const d = descricaoPolo(p, cidade);
      assert.ok(d.length <= LIMITE_META, `${p.slug}/${cidade}: ${d.length}`);
      assert.match(d, /30 a 180 dias/);
    }
  }
});

test("descrição dos bairros cabe em 155 caracteres, com bairro e cidade de nome longo", () => {
  for (const b of NOMES_LONGOS) {
    for (const cidade of CIDADES_LONGAS) {
      const d = descricaoBairro(b, cidade);
      assert.ok(d.length <= LIMITE_META, `${b}/${cidade}: ${d.length}`);
      assert.match(d, /30 a 180 dias|estadias/);
    }
  }
});

test("descrição do anúncio cabe em 155 caracteres, também com bairro e cidade longos", () => {
  const base = SAMPLE_PROPERTIES[0];
  const p = { ...base, neighborhood: NOMES_LONGOS[1], city: CIDADES_LONGAS[2] };
  assert.ok(descricaoAbaImovel(p).length <= LIMITE_META, String(descricaoAbaImovel(p).length));
});

test("home, polos, bairros e anúncio usam os geradores com limite (sem texto solto)", async () => {
  const { readFileSync } = await import("node:fs");
  assert.match(readFileSync("src/app/layout.tsx", "utf8"), /descricaoHome\(\)/);
  assert.match(readFileSync("src/app/(public)/cidades/[cidade]/[polo]/page.tsx", "utf8"), /descricaoPolo\(/);
  assert.match(readFileSync("src/components/cidades/bairro-pagina.tsx", "utf8"), /descricaoBairro\(/);
  assert.match(readFileSync("src/lib/anuncio/metadados-imovel.ts", "utf8"), /limitarMeta\(/);
});
