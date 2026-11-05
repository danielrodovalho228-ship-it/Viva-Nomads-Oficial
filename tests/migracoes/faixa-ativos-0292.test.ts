/* Roda: node --test tests/migracoes/faixa-ativos-0292.test.ts — E565: a faixa conta só os ativos de verdade. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");
const sql = (s: string) => s.replace(/--[^\n]*/g, "");
const aplRaw = ler("supabase/producao/aplicar-0292.sql");

test("0292 (arquivo e aplicar): publicado + documento aprovado + calendário nos últimos 30 dias, na faixa_dono", () => {
  for (const s of [sql(ler("supabase/migrations/0292_faixa_ativos_de_verdade.sql")), sql(aplRaw)]) {
    assert.match(s, /p\.status = 'active'/);
    assert.match(s, /p\.disponibilidade_confirmada_em >= now\(\) - interval '30 days'/);
    assert.match(s, /q\.document_status = 'approved'/);
    assert.match(s, /v_ativos := public\.imoveis_ativos_de_verdade\(p_owner\);/);
    assert.match(s, /update of status, owner_id, disponibilidade_confirmada_em on public\.properties/);
    assert.match(s, /create trigger qualification_checklists_faixa_dono after insert or delete or update of document_status, property_id/);
    assert.match(s, /create or replace function public\.atualizar_faixas_dos_donos\(\) returns integer/);
    // A janela de 30 dias da queda (0172) continua igual.
    assert.match(s, /set taxa_anterior = v_atual\.taxa_atual, queda_em = now\(\)/);
    assert.doesNotMatch(s, /contratos|AUTOMACOES|ADMIN_2FA|VN-CT-D5D50247|auth\./i);
  }
});

test("0292: aplicar entre begin/commit e registrado; rollback volta à contagem por status", () => {
  assert.match(aplRaw, /^-- [^\n]*\n-- [^\n]*\nbegin;/);
  assert.match(aplRaw, /commit;\s*$/);
  assert.match(aplRaw, /'20261104000292', '0292_faixa_ativos_de_verdade'[\s\S]*where not exists/);
  const rb = sql(ler("supabase/producao/rollback/0292_rollback.sql"));
  assert.match(rb, /select count\(\*\) into v_ativos from public\.properties where owner_id = p_owner and status = 'active';/);
  assert.match(rb, /drop function if exists public\.imoveis_ativos_de_verdade\(uuid\);/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261104000292';/);
});

test("a rotina diária recalcula a faixa (o calendário que vence não muda linha nenhuma)", () => {
  const cron = ler("src/app/api/cron/automacoes/route.ts");
  assert.match(cron, /admin\.rpc\("atualizar_faixas_dos_donos"\)/);
});
