/* Roda: node --test tests/migracoes/faixa-gestor-0293.test.ts — E564: Plano Gestor = faixa de 4% (sem assinatura). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");
const sql = (s: string) => s.replace(/--[^\n]*/g, "");
const aplRaw = ler("supabase/producao/aplicar-0293.sql");

test("0293 (arquivo e aplicar): sai a 31+, 16–30 vira 16–19 e entra 20+ = 4%; recalcula a faixa dos donos", () => {
  for (const s of [sql(ler("supabase/migrations/0293_faixa_gestor_4.sql")), sql(aplRaw)]) {
    assert.match(s, /delete from public\.faixas_comissao where min_imoveis = 31;/);
    assert.match(s, /update public\.faixas_comissao set max_imoveis = 19 where min_imoveis = 16;/);
    assert.match(s, /values \(20, null, 0\.04\)\s*on conflict \(min_imoveis\) do update/);
    assert.match(s, /select public\.atualizar_faixas_dos_donos\(\);/);
    assert.doesNotMatch(s, /contratos|AUTOMACOES|ADMIN_2FA|VN-CT-D5D50247|auth\./i);
  }
});

test("0293: aplicar entre begin/commit e registrado; rollback volta 16–30 e 31+", () => {
  assert.match(aplRaw, /^-- [^\n]*\n-- [^\n]*\nbegin;/);
  assert.match(aplRaw, /commit;\s*$/);
  assert.match(aplRaw, /'20261105000293', '0293_faixa_gestor_4'[\s\S]*where not exists/);
  const rb = sql(ler("supabase/producao/rollback/0293_rollback.sql"));
  assert.match(rb, /delete from public\.faixas_comissao where min_imoveis = 20;/);
  assert.match(rb, /values \(31, null, 0\.06\)/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261105000293';/);
});

test("servidor: administradora é Gestor (account_type) e a faixa sem teto da tabela é a do Gestor", () => {
  const t = ler("src/lib/cobranca/taxa-servidor.ts");
  assert.match(t, /from\("profiles"\)\.select\("account_type"\)\.eq\("id", ownerId\)/);
  assert.match(t, /administradora: \(perfil as \{ account_type\?: string \| null \} \| null\)\?\.account_type === "gestor",/);
  assert.match(t, /\.\.\.\(l\.max_imoveis == null \? \{ gestor: true \} : \{\}\),/);
  // Sem assinatura: nada de mensalidade do Gestor na configuração.
  const planos = ler("src/config/planos.ts");
  assert.doesNotMatch(planos, /mensalBase|porImovelAdicional|imoveisInclusos|assinaturaAnualGestor/);
  assert.match(planos, /comissao: 0\.04, \/\/ E564/);
});
