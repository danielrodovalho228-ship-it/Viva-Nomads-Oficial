/*
  Estático: a 0146 corrige a 0145 em public.messages. A INSERT "enviar mensagem" consulta messages; se a SELECT
  "mensagens das partes" tiver subconsulta ((select auth.uid())), o Postgres acusa "infinite recursion detected in
  policy for relation messages" e ninguém envia mensagem (lab t22/t41/t43 vermelhos após a 0145).
  Roda: node --experimental-strip-types --test src/lib/messages-sem-recursao-migracao.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const mig = ler("supabase/migrations/0146_messages_sem_recursao.sql");
const ap = ler("supabase/producao/aplicar-0146.sql");
const rb = ler("supabase/producao/rollback/0146_rollback.sql");
const semComentario = (s: string) => s.replace(/^--.*$/gm, "");

test("0146: SELECT de messages volta a auth.uid() direto, sem subconsulta", () => {
  const sql = semComentario(mig);
  assert.match(sql, /alter policy "mensagens das partes" on public\.messages/);
  assert.match(sql, /sender_id = auth\.uid\(\) or receiver_id = auth\.uid\(\)/);
  assert.doesNotMatch(sql, /\(\s*select/i);
  assert.doesNotMatch(sql, /drop policy|create policy|disable row level security/i);
});

test("0146: a INSERT da 0054 ainda consulta messages (motivo da guarda) e a 0146 vem depois da 0145", () => {
  assert.match(ler("supabase/migrations/0054_p0_ajustes_indicacao_mensagens.sql"), /from public\.messages m/);
  assert.ok("0146" > "0145");
});

test("0146: aplicar idempotente, begin/commit, registra em schema_migrations, com rollback", () => {
  assert.match(ap, /^begin;$/m);
  assert.match(ap, /^commit;$/m);
  assert.match(ap, /'0146_messages_sem_recursao'/);
  assert.match(ap, /where not exists \(select 1 from supabase_migrations\.schema_migrations/);
  assert.ok(ap.includes(semComentario(mig).trim()), "o aplicar contém o mesmo alter policy da migração");
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261017000146'/);
});
