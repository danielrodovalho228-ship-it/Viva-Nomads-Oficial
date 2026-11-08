/*
  Erros/estados vazios (rodada 6) — conferência de entrada/saída: falha de LEITURA não vira "conferência aberta" (editável) nem
  "não há laudo para trocar". Roda: node --test src/lib/data/e293-leituras-conferencia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync(new URL("../../../src/lib/data/conferencia-actions.ts", import.meta.url), "utf8");

test("o 'já foi fechada?' separa erro de banco de 'aberta': falha de leitura devolve erro, não deixa seguir", () => {
  assert.match(s, /const MSG_CONFERENCIA_SEM_LEITURA = "[^"]+";/);
  assert.match(s, /const \{ data, error \} = await admin\.from\("conferencias"\)\.select\("fechada_em"\)[^;]*\.maybeSingle\(\);\s*\n\s*if \(error\) return erro\(MSG_CONFERENCIA_SEM_LEITURA\);/);
  // Os 4 pontos de uso passam pelo mesmo caminho (nenhum usa o booleano cru).
  assert.doesNotMatch(s, /if \(await estaFechada\(/);
  assert.equal((s.match(/await erroDeFechamento\(/g) ?? []).length, 4);
});

test("anexar/trocar o laudo: falha ao ler o laudo existente não vira 'não há laudo para trocar' nem permite um segundo", () => {
  assert.match(s, /const \{ data: ja, error: erroLaudo \} = await admin\.from\("conferencia_laudos"\)[^;]*\.maybeSingle\(\);\s*\n\s*if \(erroLaudo\) return erro\(MSG_CONFERENCIA_SEM_LEITURA\);/);
});
