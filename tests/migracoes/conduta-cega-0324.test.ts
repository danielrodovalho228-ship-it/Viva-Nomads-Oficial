/* Roda: node --test tests/migracoes/conduta-cega-0324.test.ts — E679-B parte 3 (conduta do avaliador cega). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");
const sem = (s: string) => s.replace(/--[^\n]*/g, "");
const mig = sem(ler("supabase/migrations/0324_conduta_avaliador_cega_e679.sql"));
const apl = sem(ler("supabase/producao/aplicar-0324.sql"));
const rb = ler("supabase/producao/rollback/0324_rollback.sql");

test("a leitura do outro lado só depois de publicada; cada lado lê a própria", () => {
  for (const s of [mig, apl]) {
    assert.match(s, /autor = 'dono' and p\.owner_id = \(select auth\.uid\(\)\)/);
    assert.match(s, /autor = 'avaliador' and public\.vistoria_sou_avaliador\(p\.avaliador_id\)/);
    assert.match(s, /publicada_em is not null and \(p\.owner_id/);
  }
});

test("publica quando os dois enviam OU a janela de 14 dias do laudo fecha; sem edição; só depois do laudo", () => {
  for (const s of [mig, apl]) {
    assert.match(s, /o\.pedido_id = k\.pedido_id and o\.autor <> k\.autor/);
    assert.match(s, /vistoria_laudo_emitido_em\(k\.pedido_id\) \+ interval '14 days' <= now\(\)/);
    assert.match(s, /now\(\) > laudo \+ interval '14 days'/);
    assert.match(s, /A avaliação de conduta abre depois do laudo/);
    assert.match(s, /Avaliação de conduta enviada não pode ser alterada/);
  }
});

test("a nota pública do avaliador conta só o publicado e o desenho dos campos não mudou", () => {
  for (const s of [mig, apl]) {
    assert.match(s, /k\.autor = 'dono' and k\.publicada_em is not null/);
    assert.doesNotMatch(s, /alter table public\.vistoria_conduta (drop|alter) column/);
    assert.doesNotMatch(s, /vistoria_conduta_campos|morador/i);
  }
});

test("sem dados nem chaves; aplicar registra; rollback devolve a política e a função da 0215/0220", () => {
  for (const s of [mig, apl]) assert.doesNotMatch(s, /\btruncate|\bdelete from public|AUTOMACOES_ATIVO|ORDEM_NOVA_ATIVA|ranking_sinais|VN-CT-D5D50247/i);
  assert.match(apl, /begin;[\s\S]*20261107000324[\s\S]*commit;/);
  assert.match(rb, /create policy vistoria_conduta_le/);
  assert.match(rb, /create or replace function public\.avaliadores_publicos\(\)/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261107000324'/);
});
