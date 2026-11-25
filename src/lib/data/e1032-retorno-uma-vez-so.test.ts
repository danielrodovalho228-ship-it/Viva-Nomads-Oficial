/*
  E1032 (ORDEM-DUET-171, 19/11/2026): a Central duplicava o "Retorno" do Moacir quando a página era desenhada duas vezes
  ao mesmo tempo. postarRetornosDoMoacir conferia "já postei?" e só depois inseria; duas execuções passavam na
  conferência e as duas inseriam. Agora a inserção leva a ordem numa coluna com índice único (migração 0347): a segunda
  é recusada pelo banco. A conferência pelo texto continua (evita a ida ao banco e cobre as mensagens antigas).
  Roda: node --test src/lib/data/e1032-retorno-uma-vez-so.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fonte = readFileSync(new URL("./agentes-actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function postarRetornosDoMoacir(");
const fn = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("E1032: o Retorno é inserido com a ordem na coluna de unicidade", () => {
  assert.ok(i >= 0);
  assert.match(fn, /\.from\("agentes_conversas"\)\.insert\(\{ \.\.\.linha, retorno_da_ordem: o\.id \}\)/);
});

test("E1032: a conferência pelo texto continua antes da inserção", () => {
  const guarda = fn.indexOf("if (erroJa || (count ?? 0) > 0) continue;");
  assert.ok(guarda > 0 && guarda < fn.indexOf('.from("agentes_conversas").insert('));
});

test("E1032: sem a coluna (deploy antes da 0347), posta como antes; qualquer outro erro não vira segunda inserção", () => {
  // Só a falta da coluna leva à inserção antiga. A recusa por unicidade (23505) não: é o outro desenho que já postou.
  assert.match(fn, /if \(error && colunaAusente\(error\)\) \(\{ error \} = await supabase\.from\("agentes_conversas"\)\.insert\(linha\)\);/);
  assert.match(fonte, /const colunaAusente = \(e: \{ code\?: string \}\) => e\.code === "42703" \|\| e\.code === "PGRST204";/);
  assert.equal((fn.match(/\.from\("agentes_conversas"\)\.insert\(/g) ?? []).length, 2, "duas inserções no código: a nova e o recurso");
  assert.match(fn, /if \(!error\) n\+\+;/);
});
