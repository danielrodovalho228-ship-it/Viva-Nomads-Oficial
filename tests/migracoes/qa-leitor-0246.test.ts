import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// QA-CAIXA-B: leitor de QA das caixas de teste. Só select em emails_teste, só para qa_leitor E is_teste;
// qa_leitor só o servidor liga; nada de admin, 2FA ou outra tabela.
const sql = readFileSync("supabase/migrations/0246_qa_leitor_caixas.sql", "utf8");
const aplicar = readFileSync("supabase/producao/aplicar-0246.sql", "utf8");
const rollback = readFileSync("supabase/producao/rollback/0246_rollback.sql", "utf8");
const semComentarios = (s: string) => s.replace(/--.*$/gm, "");

test("0246: coluna qa_leitor desligada por padrão e guardada como is_teste (só service role/migração liga)", () => {
  assert.match(sql, /alter table public\.profiles add column if not exists qa_leitor boolean not null default false;/);
  assert.match(sql, /if coalesce\(auth\.role\(\), 'service_role'\) in \('authenticated', 'anon'\) then\n\s+if tg_op = 'INSERT' then\n\s+new\.qa_leitor := false;\n\s+else\n\s+new\.qa_leitor := old\.qa_leitor;/);
  assert.match(sql, /create trigger profiles_qa_leitor_guarda\n\s+before insert or update on public\.profiles/);
  // Nenhum grant: a pessoa logada não ganha update na coluna.
  assert.doesNotMatch(semComentarios(sql), /\bgrant\b/i);
});

test("0246: uma política só, de LEITURA, só em emails_teste, só para qa_leitor E is_teste", () => {
  const codigo = semComentarios(sql);
  const politicas = [...codigo.matchAll(/create policy (\w+) on ([\w.]+)\s+for (\w+) to (\w+)/g)];
  assert.equal(politicas.length, 1);
  assert.deepEqual(politicas[0].slice(1), ["emails_teste_qa_leitor_le", "public.emails_teste", "select", "authenticated"]);
  assert.match(codigo, /using \(exists \(select 1 from public\.profiles p where p\.id = auth\.uid\(\) and p\.qa_leitor and p\.is_teste\)\);/);
  assert.doesNotMatch(codigo, /enable row level security|disable row level security|security definer/i);
  // A política do admin fica como está.
  assert.doesNotMatch(codigo, /emails_teste_admin_le/);
});

test("0246: não mexe em is_admin() nem no 2FA do admin", () => {
  for (const s of [sql, aplicar, rollback]) {
    const codigo = semComentarios(s);
    assert.doesNotMatch(codigo, /is_admin/i);
    assert.doesNotMatch(codigo, /mfa|aal2|2fa/i);
  }
});

test("0246: liga a conta de QA pelo id (sem e-mail), só se for conta de teste", () => {
  assert.match(sql, /update public\.profiles\n\s+set qa_leitor = true\n\s+where id = '[0-9a-f-]{36}'\n\s+and is_teste\n\s+and not qa_leitor;/);
  for (const s of [sql, aplicar, rollback]) assert.doesNotMatch(semComentarios(s), /@[a-z0-9-]+\.[a-z]{2,}/i, "nenhum e-mail no SQL");
  assert.equal([...semComentarios(sql).matchAll(/update public\./g)].length, 1, "um único update");
});

test("0246: aplicar idempotente entre begin/commit e registrado; rollback volta tudo", () => {
  assert.match(aplicar, /^-- .*\n-- .*\nbegin;\nset local lock_timeout = '5s';/);
  assert.match(aplicar, /commit;\s*$/);
  assert.match(aplicar, /'20261024000246', '0246_qa_leitor_caixas'/);
  assert.match(aplicar, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261024000246'\);/);
  assert.ok(aplicar.includes(sql.slice(sql.indexOf("alter table public.profiles"))), "o aplicar repete a migração inteira");
  assert.match(rollback, /^-- [\s\S]*begin;[\s\S]*commit;\s*$/);
  assert.match(rollback, /drop policy if exists emails_teste_qa_leitor_le on public\.emails_teste;/);
  assert.match(rollback, /drop trigger if exists profiles_qa_leitor_guarda on public\.profiles;/);
  assert.match(rollback, /alter table public\.profiles drop column if exists qa_leitor;/);
  assert.match(rollback, /delete from supabase_migrations\.schema_migrations where version = '20261024000246';/);
  assert.doesNotMatch(semComentarios(rollback), /is_teste|emails_teste_admin_le|drop table/);
});
