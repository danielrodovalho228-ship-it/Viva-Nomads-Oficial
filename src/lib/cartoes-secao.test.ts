import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CARTOES_SECAO, cartaoSecao } from "./cartoes-secao.ts";

test("b6621ca2: fotos únicas, no padrão public/images/unicas, alt em português", () => {
  assert.equal(new Set(CARTOES_SECAO.map((c) => c.foto)).size, CARTOES_SECAO.length);
  for (const c of CARTOES_SECAO) {
    assert.match(c.foto, /^\/images\/unicas\/[a-z-]+\.webp$/);
    assert.ok(c.alt.length > 15 && c.briefing.length > 15, c.id);
  }
});

test("b6621ca2: fotoPronta só com o arquivo em public/ (e arquivo existente exige fotoPronta)", () => {
  for (const c of CARTOES_SECAO) {
    assert.equal(existsSync(join("public", c.foto)), c.fotoPronta, c.id);
  }
});

test("b6621ca2: /empresas e /para-proprietarios usam FotoCartao, sem caixa de ícone solitário", () => {
  const empresas = readFileSync("src/app/(public)/empresas/page.tsx", "utf8");
  const prop = readFileSync("src/app/(public)/para-proprietarios/page.tsx", "utf8");
  for (const [src, n] of [[empresas, 3], [prop, 4]] as const) {
    assert.match(src, /FotoCartao/);
    assert.doesNotMatch(src, /grid h-1[12] w-1[12] place-items-center rounded-xl bg-sage-100/);
    void n;
  }
  assert.equal(CARTOES_SECAO.filter((c) => c.pagina === "empresas").length, 3);
  assert.equal(CARTOES_SECAO.filter((c) => c.pagina === "para-proprietarios").length, 4);
  assert.ok(cartaoSecao("empresas", "recibo"));
});
