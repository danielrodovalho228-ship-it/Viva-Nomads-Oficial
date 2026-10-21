/*
  Serviços para o morador (ordem 521c5af7): estados do admin e a migração 0174 (RLS: o morador só vê os próprios
  pedidos). O pedido e o acompanhamento são os do Prompt 31b (parceiro_pedidos).
  Roda: node --experimental-strip-types --test src/lib/servicos-morador.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  NOTA_PAGAMENTO_DIRETO,
  codigoDoPedido,
  proximosEstados,
  rotuloEstado,
} from "./servicos-morador.ts";

test("estados, código do pedido e nota de pagamento direto", () => {
  assert.equal(rotuloEstado("enviado"), "Pedido enviado");
  assert.equal(rotuloEstado("confirmado"), "Confirmado");
  assert.equal(rotuloEstado("feito"), "Feito");
  assert.equal(rotuloEstado("qualquer"), "Pedido enviado");
  assert.equal(codigoDoPedido("1234abcd-0000-4000-8000-000000000000"), "SV-1234ABCD");
  assert.match(NOTA_PAGAMENTO_DIRETO, /paga direto ao prestador/);
  assert.match(NOTA_PAGAMENTO_DIRETO, /indica parceiros e acompanha o pedido/);
});

test("admin só avança o estado em ordem; feito e cancelado encerram", () => {
  assert.deepEqual(proximosEstados("enviado"), ["confirmado", "cancelado"]);
  assert.deepEqual(proximosEstados("confirmado"), ["feito", "cancelado"]);
  assert.deepEqual(proximosEstados("feito"), []);
  assert.deepEqual(proximosEstados("cancelado"), []);
  assert.deepEqual(proximosEstados("qualquer"), []);
});

test("migração 0174: RLS ligada, morador só lê os próprios pedidos, sem escrita direta", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/0174_servicos_pedidos.sql", import.meta.url), "utf8");
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on public\.servicos_pedidos from anon, authenticated/i);
  assert.match(sql, /tenant_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /is_admin\(\)/);
  assert.doesNotMatch(sql, /grant (insert|update|delete)[^;]*to authenticated/i);
  const prod = readFileSync(new URL("../../supabase/producao/aplicar-0174.sql", import.meta.url), "utf8");
  assert.match(prod, /^begin;/m);
  assert.match(prod, /commit;/);
  assert.match(prod, /schema_migrations/);
  assert.match(prod, /0174_servicos_pedidos/);
});
