import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// FISCAL-PARCEIRO-B (E24): o parceiro PJ declara se emite nota fiscal de serviço; PF fica sempre null (check).
const sql = readFileSync("supabase/migrations/0243_parceiro_emite_nota.sql", "utf8");
const aplicar = readFileSync("supabase/producao/aplicar-0243.sql", "utf8");
const rollback = readFileSync("supabase/producao/rollback/0243_rollback.sql", "utf8");

test("0243: emite_nota boolean null (null = não respondeu) e PF nunca guarda valor — nas duas tabelas", () => {
  assert.match(sql, /alter table public\.parceiros\n  add column if not exists emite_nota boolean,/);
  assert.match(sql, /add constraint parceiros_emite_nota_so_pj check \(tipo_pessoa = 'pj' or emite_nota is null\)/);
  assert.match(sql, /add column if not exists emite_nota boolean;/);
  assert.match(sql, /add constraint parceiro_solicitacoes_emite_nota_so_pj check \(tipo_pessoa is distinct from 'pf' or emite_nota is null\)/);
  // Selo removido por denúncia só com emite_nota = false.
  assert.match(sql, /check \(nota_selo_removido_em is null or emite_nota is false\)/);
  // Ninguém existente é alterado: sem update nem default.
  assert.doesNotMatch(sql, /\bupdate public\.parceiros\b/);
  assert.doesNotMatch(sql, /emite_nota boolean (not null|default)/);
});

test("0243: chamados aceitam o contexto 'parceiro'; a view pública ganha só tipo_pessoa e emite_nota", () => {
  assert.match(sql, /check \(contexto_tipo in \('pedido', 'contrato', 'anuncio', 'manutencao', 'parceiro'\)\)/);
  const fn = sql.slice(sql.indexOf("create function public.parceiros_publicos_lista()"), sql.indexOf("revoke all on function"));
  assert.match(fn, /teste boolean,\n  tipo_pessoa text,\n  emite_nota boolean\n\)/);
  assert.match(fn, /where p\.status = 'publicado'/);
  assert.match(fn, /security definer/);
  for (const sensivel of ["documento", "dados_recebimento", "telefone", "cep_base", "razao_social", "nota_selo_motivo"]) {
    assert.doesNotMatch(fn, new RegExp(`p\\.${sensivel}\\b`), `a view não expõe ${sensivel}`);
  }
  assert.match(sql, /create view public\.parceiros_publicos\n  with \(security_invoker = on\)/);
  assert.match(sql, /grant select on public\.parceiros_publicos to anon, authenticated;/);
  assert.match(sql, /revoke insert, update, delete, truncate, references, trigger on public\.parceiros_publicos from anon, authenticated;/);
});

test("0243: aplicar idempotente entre begin/commit, registra 0243_parceiro_emite_nota; rollback volta a 0190", () => {
  assert.match(aplicar, /^-- .*\n-- .*\nbegin;\nset local lock_timeout = '5s';/);
  assert.match(aplicar, /commit;\s*$/);
  assert.match(aplicar, /'20261024000243', '0243_parceiro_emite_nota'/);
  assert.match(aplicar, /'danielrodovalho228@gmail\.com'\nwhere not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261024000243'\)/);
  assert.ok(aplicar.includes(sql.slice(sql.indexOf("alter table public.parceiros\n"))), "o aplicar repete a migração inteira");
  for (const l of aplicar.split("\n").filter((x) => /^(alter table .* add constraint|create (function|view))/.test(x))) {
    const alvo = /add constraint (\w+)/.exec(l)?.[1];
    if (alvo) assert.ok(aplicar.includes(`drop constraint if exists ${alvo};`), `${alvo} recriável`);
  }
  assert.match(aplicar, /drop view if exists public\.parceiros_publicos;\ndrop function if exists public\.parceiros_publicos_lista\(\);/);
  assert.match(rollback, /^-- .*\n/);
  assert.match(rollback, /begin;[\s\S]*commit;\s*$/);
  assert.match(rollback, /version = '20261024000243'/);
  assert.match(rollback, /update public\.chamados set contexto_tipo = null, contexto_id = null where contexto_tipo = 'parceiro';/);
  assert.match(rollback, /check \(contexto_tipo in \('pedido', 'contrato', 'anuncio', 'manutencao'\)\)/);
  assert.match(rollback, /drop column if exists emite_nota,/);
  assert.match(rollback, /teste boolean\n\)/, "a função volta às colunas da 0190");
});
