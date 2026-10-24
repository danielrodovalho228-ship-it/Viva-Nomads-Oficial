/*
  0237 — Meus dados (perfil-04): a data de nascimento sai de user_metadata e vai para profiles.data_nascimento.
  Guarda: coluna com a mesma regra da tela (1900..hoje, sem idade), só a pessoa grava, o que já estava salvo é copiado,
  e as ações leem e gravam a coluna pela sessão.
  Roda: node --test src/lib/conta/data-nascimento-0237.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("0237: coluna date com o intervalo da tela, grant de coluna e cópia de user_metadata", () => {
  const sql = ler("supabase/migrations/0237_data_nascimento.sql");
  assert.match(sql, /add column if not exists data_nascimento date;/);
  assert.match(sql, /data_nascimento >= date '1900-01-01' and data_nascimento <= current_date/);
  assert.match(sql, /grant update \(data_nascimento\) on public\.profiles to authenticated;/);
  assert.match(sql, /raw_user_meta_data ->> 'data_nascimento'/);
  assert.doesNotMatch(sql, /grant select|to anon|18 anos|interval '18/i);
  const aplicar = ler("supabase/producao/aplicar-0237.sql");
  assert.match(aplicar, /^-- .*\nbegin;/);
  assert.match(aplicar, /commit;\s*$/);
  assert.match(aplicar, /'20261024000237', '0237_data_nascimento'/);
  assert.ok(aplicar.includes(sql.slice(sql.indexOf("alter table")).trim()), "aplicar-0237 traz o corpo da migração");
  const rollback = ler("supabase/producao/rollback/0237_rollback.sql");
  assert.match(rollback, /version = '20261024000237'/);
  assert.match(rollback, /jsonb_build_object\('data_nascimento'/, "rollback devolve as datas a user_metadata");
});

test("ações: leem e gravam profiles.data_nascimento pela sessão e limpam a cópia antiga", () => {
  const acoes = ler("src/lib/data/nascimento-actions.ts");
  assert.match(acoes, /^"use server";/);
  assert.match(acoes, /\.from\("profiles"\)\.select\("data_nascimento"\)\.eq\("id", user\.id\)/);
  assert.match(acoes, /\.from\("profiles"\)\.update\(\{ data_nascimento: r\.iso \}\)\.eq\("id", user\.id\)/);
  assert.match(acoes, /updateUser\(\{ data: \{ data_nascimento: null \} \}\)/);
  assert.doesNotMatch(acoes, /createAdminClient/);
  assert.doesNotMatch(acoes, /updateUser\(\{ data: \{ data_nascimento: r\.iso/);
});

test("exportar meus dados e inventário de retenção apontam a coluna", () => {
  assert.match(ler("src/app/api/conta/meus-dados/route.ts"), /dataNascimento: typeof perfil\?\.data_nascimento === "string"/);
  assert.match(ler("src/config/retencao.ts"), /"public\.profiles", "[^"]*data de nascimento/);
});
