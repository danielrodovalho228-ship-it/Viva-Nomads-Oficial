/*
  Ordem 8add190a: consumo e troca de lote dos códigos de recuperação 2FA são atômicos no banco.
  Estático (migração + ações) e, quando há `psql` e PG_TESTE_URL, executado de verdade (2 consumos simultâneos).
  Roda: node --experimental-strip-types --test src/lib/seguranca/recuperacao-atomica.test.ts
*/
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const mig = ler("supabase/migrations/0194_mfa_recuperacao_atomica.sql");
const ap = ler("supabase/producao/aplicar-0194.sql");
const acoes = ler("src/lib/seguranca/recuperacao-actions.ts");

test("0194: funções só para service_role, com search_path fixo e UPDATE ... WHERE usado_em IS NULL RETURNING", () => {
  assert.match(mig, /function public\.consumir_codigo_recuperacao/);
  assert.match(mig, /function public\.trocar_codigos_recuperacao/);
  assert.equal((mig.match(/set search_path = public, pg_temp/g) ?? []).length, 2);
  assert.match(mig, /and usado_em is null\s+returning id into v_id/);
  assert.match(mig, /revoke all on function public\.consumir_codigo_recuperacao\(uuid, text\) from public, anon, authenticated/);
  assert.match(mig, /revoke all on function public\.trocar_codigos_recuperacao\(uuid, text\[\]\) from public, anon, authenticated/);
  assert.match(mig, /grant execute on function public\.consumir_codigo_recuperacao\(uuid, text\) to service_role/);
  assert.match(mig, /grant execute on function public\.trocar_codigos_recuperacao\(uuid, text\[\]\) to service_role/);
  assert.doesNotMatch(mig, /grant execute[^;]*(anon|authenticated)/);
});

test("0194: aplicar idempotente, begin/commit, registra em schema_migrations; rollback existe", () => {
  assert.match(ap, /^begin;$/m);
  assert.match(ap, /^commit;$/m);
  assert.match(ap, /'0194_mfa_recuperacao_atomica'/);
  assert.match(ap, /where not exists \(select 1 from supabase_migrations\.schema_migrations/);
  assert.ok(ap.includes(mig.slice(mig.indexOf("-- Marca UM código"))), "o aplicar contém o mesmo SQL da migração");
  assert.match(ler("supabase/producao/rollback/0194_rollback.sql"), /version = '20261020000194'/);
});

test("ações: usam as funções do banco; sem UPDATE/DELETE/INSERT soltos nos códigos", () => {
  assert.match(acoes, /rpc\("consumir_codigo_recuperacao"/);
  assert.match(acoes, /rpc\("trocar_codigos_recuperacao"/);
  assert.doesNotMatch(acoes, /from\("mfa_codigos_recuperacao"\)\s*\.(update|insert)/);
  // o delete que sobra é só o de apagarFatores (apaga o conjunto antigo junto com o fator)
  assert.equal((acoes.match(/from\("mfa_codigos_recuperacao"\)\.delete\(\)/g) ?? []).length, 1);
  // código inválido nem chega ao banco; erro do banco conta como falha (não como código usado)
  assert.match(acoes, /usou = !error && data === true/);
});

const url = process.env.PG_TESTE_URL;
const psql = (sql: string) => spawnSync("psql", [url!, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" });

test("banco: dois consumos simultâneos do mesmo código → 1 ok, 1 recusado; troca de lote é tudo-ou-nada", { skip: !url }, () => {
  const u = "00000000-0000-0000-0000-0000000000aa";
  const prep = spawnSync("psql", [url!, "-X", "-q", "-v", "ON_ERROR_STOP=1"], {
    input: `
      create schema if not exists auth; create table if not exists auth.users (id uuid primary key);
      do $$ declare r text; begin foreach r in array array['anon','authenticated','service_role'] loop
        if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I', r); end if; end loop; end $$;
      ${ler("supabase/migrations/0113_mfa_codigos_recuperacao.sql").replace(/revoke all[^;]*;/g, "")}
      ${mig}
      delete from public.mfa_codigos_recuperacao; insert into auth.users values ('${u}') on conflict do nothing;
      select public.trocar_codigos_recuperacao('${u}', array['h1','h2']);`,
    encoding: "utf8",
  });
  assert.equal(prep.status, 0, prep.stderr);
  const rs = [0, 1].map(() => spawnSync("psql", [url!, "-X", "-q", "-At", "-c", `select public.consumir_codigo_recuperacao('${u}','h1')`], { encoding: "utf8" }));
  const saidas = rs.map((r) => r.stdout.trim()).sort();
  assert.deepEqual(saidas, ["f", "t"]);
  assert.equal(psql(`select public.consumir_codigo_recuperacao('${u}','inexistente')`).stdout.trim(), "f");
  // lote vazio falha e NÃO apaga o lote atual
  assert.notEqual(psql(`select public.trocar_codigos_recuperacao('${u}', array[]::text[])`).status, 0);
  assert.equal(psql(`select count(*) from public.mfa_codigos_recuperacao where user_id='${u}'`).stdout.trim(), "2");
});
