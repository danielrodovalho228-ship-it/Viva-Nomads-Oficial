import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Achado 180 (varredura "leitura que falha não vira outra resposta"): aprovarSugestao lia a nota da IA sem olhar o erro —
 * a falha virava "Sugestão não encontrada neste chamado.", e a equipe achava que a sugestão tinha sumido.
 */
const fonte = readFileSync(new URL("./atendimento-actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function aprovarSugestao(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("aprovarSugestao: leitura da sugestão com erro não vira 'Sugestão não encontrada'", () => {
  assert.match(f, /const \{ data: m, error: erroSugestao \} = await ctx\.admin\.from\("chamado_mensagens"\)/);
  const g = f.indexOf("if (erroSugestao)");
  assert.ok(g >= 0);
  assert.match(f.slice(g, g + 140), /Não foi possível ler a sugestão agora/);
  assert.ok(g < f.indexOf("Sugestão não encontrada neste chamado."));
  assert.ok(g < f.indexOf("responderComoAdmin("));
});
