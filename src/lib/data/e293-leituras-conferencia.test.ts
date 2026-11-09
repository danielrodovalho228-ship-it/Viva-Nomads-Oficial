// Frente "erros/estados vazios": leitura que falha na conferência não vira "aberta" nem "sem laudo".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./conferencia-actions.ts", import.meta.url), "utf8");

test("motivoFechada separa leitura que falhou de conferência aberta e substitui estaFechada nas 4 ações", () => {
  assert.doesNotMatch(src, /estaFechada/);
  assert.match(src, /const \{ data, error \} = await admin\.from\("conferencias"\)\.select\("fechada_em"\)/);
  assert.match(src, /if \(error\) return ERRO_SEM_LEITURA;/);
  assert.equal((src.match(/await motivoFechada\(/g) ?? []).length, 4);
});

test("o laudo existente só é decidido depois de checar o erro da leitura", () => {
  const i = src.indexOf("erroLaudo");
  assert.ok(i > 0);
  assert.ok(src.indexOf("if (erroLaudo) return erro(ERRO_SEM_LEITURA)") < src.indexOf("if (ja && !substituir)"));
});
