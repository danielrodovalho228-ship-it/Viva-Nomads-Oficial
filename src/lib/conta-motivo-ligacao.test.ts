/*
  Ordem a8bb8cfa: o motivo da estadia do perfil chega ao banco, à Conta e ao pedido.
  Roda: node --test src/lib/conta-motivo-ligacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("servidor valida o motivo e grava só na própria linha do perfil", () => {
  const a = ler("src/lib/data/perfil-actions.ts");
  assert.match(a, /validarMotivoEstadia/);
  assert.match(a, /motivo_estadia/);
  assert.match(a, /\.eq\("id", user\.id\)/);
});

test("migração 0141: coluna, permissão só da coluna, aplicar e rollback", () => {
  const m = ler("supabase/migrations/0141_motivo_estadia_perfil.sql");
  assert.match(m, /add column if not exists motivo_estadia/i);
  assert.match(m, /grant update \(motivo_estadia\) on public\.profiles to authenticated/i);
  const ap = ler("supabase/producao/aplicar-0141.sql");
  assert.match(ap, /^begin;/m);
  assert.match(ap, /commit;\s*$/);
  assert.match(ap, /0141_motivo_estadia_perfil/);
  assert.match(ler("supabase/producao/rollback/0141_rollback.sql"), /drop column if exists motivo_estadia/i);
});

test("E64 (QA 24/10): Meus dados não pergunta o motivo — o desenho perfil-04 não tem; ele é perguntado no pedido", () => {
  const c = ler("src/components/account/conta-secoes.tsx");
  assert.doesNotMatch(c, /data-testid="perfil-motivo-estadia"/);
  assert.doesNotMatch(c, /motivoEstadia/);
});

test("pedido novo pré-preenche com o motivo do perfil, sem sobrescrever o que já tem", () => {
  const p = ler("src/app/(public)/pedidos/novo/page.tsx");
  assert.match(p, /getMeusDados/);
  assert.match(p, /motivoEstadia/);
});
