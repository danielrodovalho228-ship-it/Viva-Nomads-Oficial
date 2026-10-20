import test from "node:test";
import assert from "node:assert/strict";
import { SAMPLE_PROPERTIES } from "../properties.ts";
import { descricaoAbaImovel } from "./metadados-imovel.ts";

// Ordem 17e551e2 (#145): a meta description começa por "Imóvel mobiliado", nunca por "Apartamento mobiliado".
test("descrição do anúncio começa por 'Imóvel mobiliado' e cabe em 155 caracteres", () => {
  for (const p of SAMPLE_PROPERTIES) {
    const d = descricaoAbaImovel(p);
    assert.match(d, /^Imóvel mobiliado em /, p.id);
    assert.ok(d.length <= 155, `${p.id}: ${d.length} caracteres`);
    assert.doesNotMatch(d, /mobiliada/i, p.id);
    assert.match(d, /30 a 180 dias/, p.id);
  }
});

test("meta description de /precos: ≤155 caracteres, com 12% e 'imóveis mobiliados'", async () => {
  const { DESCRICAO_PRECOS } = await import("../cobranca/regra.ts");
  assert.ok(DESCRICAO_PRECOS.length <= 155, String(DESCRICAO_PRECOS.length));
  assert.match(DESCRICAO_PRECOS, /12%/);
  assert.match(DESCRICAO_PRECOS, /imóveis mobiliados/);
});

test("subtítulo de /cidades/[cidade] não usa 'mobiliada e pronta'", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("src/app/(public)/cidades/[cidade]/page.tsx", "utf8");
  assert.doesNotMatch(src, /mobiliada e pronta/);
  assert.match(src, /Imóveis mobiliados e prontos para morar em/);
});
