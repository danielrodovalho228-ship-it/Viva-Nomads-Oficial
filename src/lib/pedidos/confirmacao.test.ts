/*
  Pedido de moradia só chega aos proprietários com e-mail E telefone confirmados (ordem 8dca1437, item 3).
  Roda: node --test src/lib/pedidos/confirmacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contatoConfirmado, faltaConfirmar, AVISO_CONFIRMACAO } from "./confirmacao.ts";

const ok = { emailConfirmadoEm: "2026-10-01T00:00:00Z", telefoneConfirmadoEm: "2026-10-02T00:00:00Z", telefoneVerificadoEm: "2026-10-02T00:00:00Z" };

test("e-mail e telefone confirmados: o pedido chega aos proprietários", () => {
  assert.equal(contatoConfirmado(ok), true);
  assert.deepEqual(faltaConfirmar(ok), []);
});

test("sem e-mail confirmado: não chega", () => {
  const s = { ...ok, emailConfirmadoEm: null };
  assert.equal(contatoConfirmado(s), false);
  assert.deepEqual(faltaConfirmar(s), ["e-mail"]);
});

test("sem telefone confirmado ou sem registro da verificação: não chega", () => {
  assert.equal(contatoConfirmado({ ...ok, telefoneConfirmadoEm: null }), false);
  assert.equal(contatoConfirmado({ ...ok, telefoneVerificadoEm: undefined }), false);
  assert.deepEqual(faltaConfirmar({ ...ok, telefoneVerificadoEm: null }), ["telefone"]);
});

test("nada confirmado: falta e-mail e telefone", () => {
  assert.deepEqual(faltaConfirmar({ emailConfirmadoEm: null, telefoneConfirmadoEm: null, telefoneVerificadoEm: null }), ["e-mail", "telefone"]);
});

test("o aviso da tela explica a regra sem prometer o que não acontece", () => {
  assert.match(AVISO_CONFIRMACAO, /e-mail e telefone confirmados/);
  assert.doesNotMatch(AVISO_CONFIRMACAO, /aluguel|comiss|corretag|intermedia/i);
});

test("migração 0157: o mural só lista pedido de quem confirmou e-mail e telefone", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/0157_pedidos_contato_confirmado.sql", import.meta.url), "utf8");
  assert.match(sql, /email_confirmed_at is not null/);
  assert.match(sql, /phone_confirmed_at is not null/);
  assert.match(sql, /telefone_verificacao/);
  const aplicar = readFileSync(new URL("../../../supabase/producao/aplicar-0157.sql", import.meta.url), "utf8");
  assert.match(aplicar, /^begin;/m);
  assert.match(aplicar, /commit;\s*$/);
  assert.match(aplicar, /20261018000157/);
  assert.match(aplicar, /not exists \(select 1 from supabase_migrations\.schema_migrations/);
  const volta = readFileSync(new URL("../../../supabase/producao/rollback/0157_rollback.sql", import.meta.url), "utf8");
  assert.match(volta, /delete from supabase_migrations\.schema_migrations where version = '20261018000157'/);
});
