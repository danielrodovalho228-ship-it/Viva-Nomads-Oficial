import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const acao = readFileSync("src/lib/data/estrutura-actions.ts", "utf8");
const migracao = readFileSync("supabase/migrations/0214_selos_estrutura.sql", "utf8");

test("ação do checklist: valida a entrada e confere o dono no servidor antes de gravar", () => {
  const iValida = acao.indexOf("validarChecklistEstrutura(checklist)");
  const iDono = acao.indexOf("owner_id !== user.id");
  const iGrava = acao.indexOf(".upsert(");
  assert.ok(iValida > 0 && iDono > iValida && iGrava > iDono);
});

test("migração 0214: RLS ligada, escrita só do servidor, leitura pública só do anúncio ativo", () => {
  assert.match(migracao, /enable row level security/);
  assert.match(migracao, /revoke all on public\.imovel_estrutura from anon, authenticated/);
  assert.doesNotMatch(migracao, /grant (insert|update|delete|all)[^;]*to (anon|authenticated)/);
  assert.match(migracao, /p\.status::text = 'active'/);
});
