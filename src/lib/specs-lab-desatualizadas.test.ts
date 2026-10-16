import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CAPAS } from "../components/dashboard/capas.ts";

// Ordem 75553f0a (laboratório verde): specs não fixam mais o que o produto mudou.
const raiz = process.cwd();
const spec = (nome: string) => readFileSync(join(raiz, "tests/e2e/specs", nome), "utf8");

test("t86 confere o alt da capa do painel, que existe em CAPAS.imoveis", () => {
  assert.match(CAPAS.imoveis.alt, /sala mobiliada/i);
  assert.doesNotMatch(CAPAS.imoveis.alt, /apartamento mobiliado/i);
  const t86 = spec("t86-decisao-avatar-alt.spec.ts");
  assert.match(t86, /painel-capa/);
  assert.doesNotMatch(t86, /getByAltText\("Sala de imóvel mobiliado preparada/);
});

test("t140/t141 não fixam o total de fotos do anúncio de exemplo", () => {
  for (const nome of ["t140-galeria-lightbox.spec.ts", "t141-galeria-1536.spec.ts"]) {
    const s = spec(nome);
    assert.doesNotMatch(s, /const TOTAL = \d+/, nome);
    assert.match(s, /posicao\(/, nome);
  }
});

test("t100 aceita ids de anúncio de exemplo (ube-001) na URL de comparar", () => {
  assert.doesNotMatch(spec("t100-comparar-imoveis.spec.ts"), /\[0-9a-f-\]\{36\}/);
});
