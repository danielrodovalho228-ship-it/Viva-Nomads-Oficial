/*
  E668 — o morador (Lucas, que TAMBÉM tem parceria) abria a casca em "Áreas do parceiro": o papel_ativo = 'parceiro' estava
  gravado SEM clique (antes do E653 a área do parceiro gravava o papel sozinha) e nada o distinguia de uma escolha de
  verdade. Agora o papel 'parceiro' só vale como papel gravado se foi ESCOLHIDO (selo ou Conta): `papel_ativo_escolhido_em`.
  Sem o carimbo (valor antigo, gravado pela área), a conta abre no modo dela (morador/proprietário) e troca para parceiro com um toque.
  Roda: node --test src/lib/papel/e668-papel-escolhido.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { papelGravadoEfetivo } from "./papel-ativo.ts";

const raiz = new URL("../../../", import.meta.url);
const ler = (p: string) => readFileSync(new URL(p, raiz), "utf8");

test("parceiro gravado SEM escolha (valor antigo da área) não vale: abre no modo da conta", () => {
  assert.equal(papelGravadoEfetivo("parceiro", null), null);
  assert.equal(papelGravadoEfetivo("parceiro", undefined), null);
  assert.equal(papelGravadoEfetivo("parceiro", ""), null);
});

test("parceiro escolhido (com carimbo) vale; morador e proprietário valem sempre; lixo vira nulo", () => {
  assert.equal(papelGravadoEfetivo("parceiro", "2026-11-07T10:00:00Z"), "parceiro");
  assert.equal(papelGravadoEfetivo("morador", null), "morador");
  assert.equal(papelGravadoEfetivo("proprietario", null), "proprietario");
  assert.equal(papelGravadoEfetivo("admin", "2026-11-07T10:00:00Z"), null);
  assert.equal(papelGravadoEfetivo(null, null), null);
});

test("a casca (login) e a lista de papéis usam a regra; a leitura nova é tolerante à migração ainda não aplicada", () => {
  const auth = ler("src/components/auth-provider.tsx");
  const acoes = ler("src/lib/data/papel-actions.ts");
  assert.match(auth, /papelGravadoEfetivo\(/);
  assert.match(acoes, /papelGravadoEfetivo\(/);
  // A coluna nova NUNCA entra no select principal do perfil (se a migração atrasar, o login não pode quebrar).
  assert.doesNotMatch(auth, /select\("full_name, role, preferred_mode, papel_ativo, papel_ativo_escolhido_em/);
  assert.match(auth, /papel_ativo_escolhido_em/);
});

test("escolher parceiro (selo/Conta) carimba; a troca por área não grava nada (E653)", () => {
  const acoes = ler("src/lib/data/papel-actions.ts");
  assert.match(acoes, /papel_ativo_escolhido_em: new Date\(\)\.toISOString\(\)/);
  assert.match(acoes, /42703|undefined_column|papel_ativo_escolhido_em[\s\S]{0,200}tenta/i);
});

test("migração 0318 aditiva, idempotente, registrada, com grant da coluna e rollback", () => {
  const mig = ler("supabase/migrations/0318_papel_escolhido_e668.sql");
  const ap = ler("supabase/producao/aplicar-0318.sql");
  assert.ok(existsSync(new URL("supabase/producao/rollback/0318_rollback.sql", raiz)));
  assert.match(mig, /add column if not exists papel_ativo_escolhido_em timestamptz/);
  assert.match(ap, /add column if not exists papel_ativo_escolhido_em timestamptz/);
  assert.match(ap, /grant update \(papel_ativo_escolhido_em\) on public\.profiles to authenticated/);
  assert.match(ap, /^begin;/m);
  assert.match(ap, /commit;\s*$/);
  assert.match(ap, /insert into supabase_migrations\.schema_migrations[\s\S]*0318_papel_escolhido_e668[\s\S]*where not exists/);
  assert.doesNotMatch(mig + ap, /drop |delete from|truncate|update public\.profiles/i);
});
