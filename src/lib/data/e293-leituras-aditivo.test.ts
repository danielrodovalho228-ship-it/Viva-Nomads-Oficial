/*
  Erros/estados vazios (rodada 5) — aditivo da estadia: falha de LEITURA não vira "Proposta não encontrada." nem deixa passar
  "você já assinou?" como se não tivesse assinado.
  Roda: node --test src/lib/data/e293-leituras-aditivo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync(new URL("../../../src/lib/data/estadia-actions.ts", import.meta.url), "utf8");

test("carregarAditivo separa erro de banco de 'Proposta não encontrada.'", () => {
  assert.match(s, /const MSG_ADITIVO_SEM_LEITURA = "[^"]+";/);
  assert.match(
    s,
    /const \{ data, error: erroAditivo \} = await admin\.from\("contrato_aditivos"\)[^;]*\.maybeSingle\(\);\s*\n\s*if \(erroAditivo\) return \{ erro: MSG_ADITIVO_SEM_LEITURA \};/,
  );
});

test("pedir o código do aditivo: falha ao ler a assinatura anterior não passa como 'ainda não assinou'", () => {
  assert.match(
    s,
    /const \{ data: ja, error: erroJa \} = await ctx\.admin\.from\("contrato_aditivo_assinaturas"\)[^;]*\.maybeSingle\(\);\s*\n\s*if \(erroJa\) return \{ ok: false, erro: MSG_ADITIVO_SEM_LEITURA \};/,
  );
});
