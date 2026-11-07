import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Achado 185 (varredura "leitura que falha não vira outra resposta"): estaFechada lia a conferência sem olhar o erro —
 * a falha virava "não está fechada" e a ação seguia como se estivesse aberta (só o banco ainda recusava). E a leitura
 * de "já tem laudo" com erro deixava seguir para anexar um segundo laudo.
 */
const fonte = readFileSync(new URL("./conferencia-actions.ts", import.meta.url), "utf8");

test("a leitura de 'fechada' devolve o motivo certo: fechada, sem leitura ou aberta", () => {
  assert.match(fonte, /async function motivoDeFechada\(/);
  const f = fonte.slice(fonte.indexOf("async function motivoDeFechada("), fonte.indexOf("\n}\n", fonte.indexOf("async function motivoDeFechada(")) + 2);
  assert.match(f, /const \{ data, error \} = await admin\.from\("conferencias"\)/);
  assert.match(f, /if \(error\) return ERRO_SEM_LEITURA/);
  assert.match(f, /return data\?\.fechada_em \? ERRO_FECHADA : null/);
  assert.match(fonte, /const ERRO_SEM_LEITURA = "Não foi possível ler a conferência agora\. Tente de novo\."/);
});

test("as quatro ações de escrita usam o motivo (não o booleano que escondia a falha)", () => {
  assert.doesNotMatch(fonte, /if \(await estaFechada\(/);
  const usos = fonte.match(/const fechada = await motivoDeFechada\(/g) ?? [];
  assert.equal(usos.length, 4);
  assert.equal((fonte.match(/if \(fechada\) return erro\(fechada\);/g) ?? []).length, 4);
});

test("anexar laudo: leitura de 'já tem laudo' com erro não segue para anexar outro", () => {
  assert.match(fonte, /const \{ data: ja, error: erroJa \} = await admin\.from\("conferencia_laudos"\)/);
  const g = fonte.indexOf("if (erroJa)");
  assert.ok(g >= 0);
  assert.ok(g < fonte.indexOf("Esta conferência já tem um laudo independente anexado."));
});
