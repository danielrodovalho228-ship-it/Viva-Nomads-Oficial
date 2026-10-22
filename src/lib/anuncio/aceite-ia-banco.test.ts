/*
  Ordem ea41ad13 (#59): publicar com texto de IA exige o aceite NO BANCO (migração 0203), além da Server Action.
  Roda: node --test src/lib/anuncio/aceite-ia-banco.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const raiz = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const mig = raiz("supabase/migrations/0203_aceite_ia_publicar.sql");

test("0203: só barra a transição para 'active' de texto de IA sem aceite, com erro 23514", () => {
  assert.match(mig, /new\.status::text = 'active'/);
  assert.match(mig, /coalesce\(new\.descricao_gerada_por_ia, false\)/);
  assert.match(mig, /tg_op = 'INSERT' or old\.status::text is distinct from 'active'/);
  assert.match(mig, /not exists \(select 1 from public\.anuncio_aceites_ia a where a\.property_id = new\.id\)/);
  assert.match(mig, /errcode = '23514'/);
  assert.match(mig, /before insert or update of status on public\.properties/);
});

test("0203: isenta só o dono do banco, o service_role e gatilhos aninhados (caso negativo: o dono não é isento)", () => {
  assert.match(mig, /current_user not in \('supabase_admin', 'postgres', 'service_role'\)/);
  assert.match(mig, /pg_trigger_depth\(\) <= 1/);
  assert.doesNotMatch(mig, /is_admin\(\)|authenticated/);
});

test("0203: idempotente, sem NOTICE, com aplicar e rollback no padrão", () => {
  assert.match(mig, /create or replace function/);
  assert.match(mig, /create or replace trigger/);
  assert.doesNotMatch(mig, /raise notice|drop trigger(?! if exists)/i);
  const ap = raiz("supabase/producao/aplicar-0203.sql");
  assert.match(ap, /^begin;$/m);
  assert.match(ap, /^commit;$/m);
  assert.match(ap, /'0203_aceite_ia_publicar'/);
  assert.match(ap, /where not exists \(select 1 from supabase_migrations\.schema_migrations/);
  const rb = raiz("supabase/producao/rollback/0203_rollback.sql");
  assert.match(rb, /drop trigger if exists trg_properties_exige_aceite_ia/);
  assert.match(rb, /drop function if exists public\.properties_exige_aceite_ia\(\)/);
});

test("o app grava o aceite ANTES de ativar o imóvel, nos dois caminhos (senão o gatilho barraria o dono)", () => {
  const src = raiz("src/lib/data/actions.ts");
  const pos = [...src.matchAll(/exigirAceiteIa\(supabase, /g)].map((m) => m.index!);
  const ativa = [...src.matchAll(/\.update\(\{ status: (?:input\.asDraft \? "draft" : "active"|"active", draft_data: null) \}\)/g)].map((m) => m.index!);
  assert.equal(pos.length, 2);
  assert.equal(ativa.length, 2);
  pos.forEach((p, i) => assert.ok(p < ativa[i], `caminho ${i + 1}: aceite antes de ativar`));
});
