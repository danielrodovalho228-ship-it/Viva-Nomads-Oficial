import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// FOTO-PERFIL-B (E13): fila de revisão das fotos de perfil; a migração não apaga nada.
const sql = readFileSync("supabase/migrations/0244_fotos_perfil_revisao.sql", "utf8");
const aplicar = readFileSync("supabase/producao/aplicar-0244.sql", "utf8");
const rollback = readFileSync("supabase/producao/rollback/0244_rollback.sql", "utf8");

test("0244: a migração NÃO apaga nada (nem foto, nem perfil, nem arquivo) e não mexe no avatar existente", () => {
  for (const s of [sql, aplicar]) {
    assert.doesNotMatch(s, /\bdelete\s+from\b/i);
    assert.doesNotMatch(s, /\btruncate\b/i);
    assert.doesNotMatch(s, /storage\.objects/);
    assert.doesNotMatch(s.replace(/create or replace function[\s\S]*?\$\$;/, ""), /update public\.profiles/, "fora da função de envio, nenhum update no perfil");
  }
  // Cada avatar atual (caminho canônico) ganha uma linha 'em_revisao', uma vez só.
  assert.match(sql, /insert into public\.fotos_perfil_revisao \(user_id, caminho, enviada_em\)\nselect p\.id, p\.avatar_url, coalesce\(p\.avatar_atualizado_em, now\(\)\)/);
  assert.match(sql, /and not exists \(select 1 from public\.fotos_perfil_revisao r where r\.user_id = p\.id and r\.status = 'em_revisao'\)/);
});

test("0244: estados, motivo da lista só na remoção, uma revisão aberta por pessoa e RLS", () => {
  assert.match(sql, /status text not null default 'em_revisao' check \(status in \('em_revisao', 'aprovada', 'removida'\)\)/);
  assert.match(sql, /\(status <> 'removida' and motivo is null\)/);
  assert.match(sql, /create unique index if not exists fotos_perfil_revisao_uma_aberta on public\.fotos_perfil_revisao \(user_id\) where status = 'em_revisao';/);
  assert.match(sql, /alter table public\.fotos_perfil_revisao enable row level security;/);
  assert.match(sql, /for select to authenticated using \(user_id = auth\.uid\(\) or public\.is_admin\(\)\)/);
  assert.match(sql, /for update to authenticated using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\)/);
  assert.match(sql, /revoke all on public\.fotos_perfil_revisao from anon, authenticated;/);
  assert.doesNotMatch(sql, /grant (insert|delete)[^;]*fotos_perfil_revisao/);
  assert.match(sql, /check \(contexto_tipo in \('pedido', 'contrato', 'anuncio', 'manutencao', 'parceiro', 'perfil'\)\)/);
});

test("0244: aplicar idempotente entre begin/commit e registrado; rollback não apaga avatar", () => {
  assert.match(aplicar, /^-- .*\n-- .*\nbegin;\nset local lock_timeout = '5s';/);
  assert.match(aplicar, /commit;\s*$/);
  assert.match(aplicar, /'20261024000244', '0244_fotos_perfil_revisao'/);
  assert.ok(aplicar.includes(sql.slice(sql.indexOf("create table if not exists public.fotos_perfil_revisao"))), "o aplicar repete a migração inteira");
  assert.match(rollback, /begin;[\s\S]*commit;\s*$/);
  assert.match(rollback, /version = '20261024000244'/);
  assert.match(rollback, /drop table if exists public\.fotos_perfil_revisao;/);
  assert.doesNotMatch(rollback, /public\.profiles/, "o rollback não mexe no perfil (os avatares ficam)");
  assert.match(rollback, /check \(contexto_tipo in \('pedido', 'contrato', 'anuncio', 'manutencao', 'parceiro'\)\)/);
});
