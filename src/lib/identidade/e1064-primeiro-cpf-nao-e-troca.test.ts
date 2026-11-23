/*
  E1064, perna 1 (ORDEM-DUET-392/406): o selo "Identidade pendente" da moradora com a identidade confirmada.
  A leitura de produção de 21/11 mostrou o laudo dela vencido 6 minutos depois de criado. A causa: a regra do banco
  "trocou o nome ou o CPF → a identidade deixa de valer" (0164) também disparava quando a pessoa CADASTRAVA o CPF pela
  primeira vez (de vazio para um número). Numa conta de teste a verificação simulada não pede CPF; o Fechamento pede o
  CPF do morador depois; ela cadastrou e o laudo venceu na hora.
  A regra decidida (Daniel, 18/10) fala de TROCA. Cadastrar o primeiro CPF não é troca.
  Esta trava lê o texto da migração; o comportamento no banco é da trava de tela t1724.
  Roda: node --test src/lib/identidade/e1064-primeiro-cpf-nao-e-troca.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const MIGRACAO = ler("supabase/migrations/0352_caf_primeiro_cpf_nao_e_troca_e1064.sql");
const APLICAR = ler("supabase/producao/aplicar-0352.sql");
const ROLLBACK = ler("supabase/producao/rollback/0352_rollback.sql");
const semComentarios = (s: string) => s.replace(/^\s*--.*$/gm, "");

test("a regra: o nome mudou, ou o CPF que JÁ EXISTIA mudou — cadastrar o primeiro CPF não vence a identidade", () => {
  for (const sql of [MIGRACAO, APLICAR]) {
    const corpo = semComentarios(sql);
    assert.match(corpo, /create or replace function public\.caf_reverificar_por_troca\(\)/);
    assert.match(corpo, /if new\.full_name is distinct from old\.full_name\s+or \(old\.cpf is not null and new\.cpf is distinct from old\.cpf\) then/);
    assert.doesNotMatch(corpo, /or new\.cpf is distinct from old\.cpf then/, "a condição antiga (qualquer mudança de CPF) saiu");
    // O que a regra faz quando dispara não mudou: o laudo em vigor deixa de valer e a cota é liberada.
    assert.match(corpo, /update public\.tenant_verifications\s+set valid_until = now\(\)\s+where tenant_id = new\.id\s+and \(valid_until is null or valid_until > now\(\)\);/);
    assert.match(corpo, /delete from public\.limites_uso where chave = 'caf:user:' \|\| new\.id::text;/);
    assert.match(corpo, /revoke all on function public\.caf_reverificar_por_troca\(\) from public, anon, authenticated;/);
  }
});

test("a migração só troca a função: o gatilho, as tabelas e os dados ficam como estão", () => {
  const corpo = semComentarios(MIGRACAO);
  assert.doesNotMatch(corpo, /\b(drop|alter|truncate)\b/i);
  assert.doesNotMatch(corpo, /create trigger/i, "o gatilho da 0164 continua o mesmo");
  // Não mexe em laudo nenhum na aplicação: só a função roda UPDATE/DELETE, e só quando o gatilho dispara.
  assert.equal((corpo.match(/\bupdate public\./g) ?? []).length, 1);
  assert.equal((corpo.match(/\bdelete from public\./g) ?? []).length, 1);
});

test("o aplicar de produção: idempotente, entre begin e commit, e registra-se com o nome da migração", () => {
  const corpo = semComentarios(APLICAR).trim();
  assert.match(corpo, /^begin;/);
  assert.match(corpo, /commit;$/);
  assert.match(corpo, /insert into supabase_migrations\.schema_migrations \(version, name\)\s+select '20261122000352', '0352_caf_primeiro_cpf_nao_e_troca_e1064'\s+where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261122000352'\);/);
});

test("o rollback devolve a regra da 0164 (qualquer mudança de CPF) e tira o registro", () => {
  const corpo = semComentarios(ROLLBACK).trim();
  assert.match(corpo, /^begin;/);
  assert.match(corpo, /commit;$/);
  assert.match(corpo, /if new\.full_name is distinct from old\.full_name or new\.cpf is distinct from old\.cpf then/);
  assert.match(corpo, /delete from supabase_migrations\.schema_migrations where version = '20261122000352';/);
});
