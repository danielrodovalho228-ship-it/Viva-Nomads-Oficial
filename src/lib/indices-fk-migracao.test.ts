import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem 0f66a754, item 3: a 0157 cria índice nas FKs sem índice e vem completa (aplicar + rollback).
const le = (p: string) => readFileSync(new URL(`../../supabase/${p}`, import.meta.url), "utf8");

test("0157: cria os dois índices, de forma idempotente, e não mexe em política", () => {
  const mig = le("migrations/0157_indices_chaves_estrangeiras.sql");
  assert.match(mig, /create index if not exists idx_pedidos_ajuda_publicacao_property_id on public\.pedidos_ajuda_publicacao \(property_id\)/);
  assert.match(mig, /create index if not exists idx_property_negociacao_limites_owner_id on public\.property_negociacao_limites \(owner_id\)/);
  assert.doesNotMatch(mig.replace(/--.*$/gm, ""), /policy/i);
});

test("0157: aplicar-0157 registra a migração e o rollback desfaz", () => {
  const ap = le("producao/aplicar-0157.sql");
  assert.match(ap, /^begin;/m);
  assert.match(ap, /commit;\s*$/);
  assert.match(ap, /'0157_indices_chaves_estrangeiras'/);
  assert.match(ap, /where not exists/);
  const rb = le("producao/rollback/0157_rollback.sql");
  assert.match(rb, /drop index if exists public\.idx_pedidos_ajuda_publicacao_property_id/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261018000157'/);
});
