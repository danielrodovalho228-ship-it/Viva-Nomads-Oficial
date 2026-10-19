import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shell = readFileSync("src/components/layout/dashboard-shell.tsx", "utf8");
const acoes = readFileSync("src/lib/data/agentes-actions.ts", "utf8");

// F15 (ordem 7ac560e7): o selo "N aguardando" de Agentes conta o que espera o OK do Daniel,
// não achados P1 das rondas.
test("selo de Agentes usa aprovações pendentes, não achados P1", () => {
  assert.match(shell, /"admin-agentes": aprovacoesPendentes/);
  assert.doesNotMatch(shell, /contarAchadosP1/);
  assert.doesNotMatch(shell, /"admin-agentes": achadosP1/);
});

test("contarAprovacoesPendentes: só admin e só pendentes dentro do prazo", () => {
  const corpo = acoes.slice(acoes.indexOf("export async function contarAprovacoesPendentes"));
  const fim = corpo.slice(0, corpo.indexOf("\n}\n"));
  assert.match(fim, /ehAdmin\(supabase, user\.id\)\)\) return 0/);
  assert.match(fim, /\.eq\("status", "pendente"\)/);
  assert.match(fim, /\.gt\("expira_em"/);
});
