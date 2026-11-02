import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: leituras falhas nunca mandam lembrete a conta de teste nem a quem está na fila. */
const fonte = readFileSync(new URL("./servidor.ts", import.meta.url), "utf8");
function corpo(nome: string): string {
  const i = fonte.search(new RegExp(`(export )?async function ${nome}\\(`));
  assert.ok(i >= 0, nome);
  return fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);
}

test("teste() devolve null na falha de leitura", () => {
  const f = corpo("teste");
  assert.match(f, /Promise<Set<string> \| null>/);
  assert.match(f, /if \(error\) return null;/);
});

test("lembretesDoFunil: sem a lista de contas de teste, a rodada não sai", () => {
  const f = corpo("lembretesDoFunil");
  const g = f.indexOf("if (!contasTeste) return r;");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("await notify("));
});

test("lembretesDoFunil: fila de revisão ilegível pula a verificação parada", () => {
  const f = corpo("lembretesDoFunil");
  const g = f.indexOf("if (erroRevisao) ultima.clear();");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("for (const [userId, t] of ultima)"));
});
