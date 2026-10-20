/*
  Ordem c9f6d762: funções SECURITY DEFINER só de admin deixam de ser executáveis por `authenticated`.
  Estático (migração + chamadores). Roda: node --experimental-strip-types --test src/lib/seguranca/revogar-execute-admin.test.ts
*/
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const FUNCOES = [
  "admin_financeiro(date, date, text)",
  "admin_financeiro_recorte(date, date, text, text)",
  "admin_visao_geral(date, date, text)",
  "admin_atendimento_metricas(integer)",
  "marcar_fundador(uuid)",
];

test("0195: revoga de public, anon e authenticated e deixa só service_role", () => {
  const mig = ler("supabase/migrations/0195_revogar_execute_admin.sql");
  for (const f of FUNCOES) {
    assert.ok(mig.includes(`revoke all on function public.${f} from public, anon, authenticated;`), `revoke de ${f}`);
    assert.ok(mig.includes(`grant execute on function public.${f} to service_role;`), `grant de ${f}`);
  }
  assert.doesNotMatch(mig, /grant execute[^;]*\bto (anon|authenticated|public)\b/);
});

test("0195: aplicar idempotente entre begin/commit, registra a migração; rollback devolve o acesso", () => {
  const ap = ler("supabase/producao/aplicar-0195.sql");
  assert.match(ap, /^begin;$/m);
  assert.match(ap, /^commit;$/m);
  assert.match(ap, /'20261020000195', '0195_revogar_execute_admin'/);
  assert.match(ap, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261020000195'\)/);
  for (const f of FUNCOES) assert.ok(ap.includes(`revoke all on function public.${f} from public, anon, authenticated;`));
  assert.ok(existsSync(new URL("../../../supabase/producao/rollback/0195_rollback.sql", import.meta.url)));
  const rb = ler("supabase/producao/rollback/0195_rollback.sql");
  for (const f of FUNCOES) assert.ok(rb.includes(`grant execute on function public.${f} to authenticated;`));
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261020000195'/);
});

test("nenhum chamador usa as funções com a sessão do usuário (todos via cliente de serviço)", () => {
  for (const [arq, rpc] of [
    ["src/lib/data/admin-financeiro.ts", "admin_financeiro_recorte"],
    ["src/lib/data/admin-visao-geral.ts", "admin_visao_geral"],
    ["src/lib/data/admin-indicadores.ts", "admin_atendimento_metricas"],
    ["src/lib/data/atendimento-actions.ts", "admin_atendimento_metricas"],
  ] as const) {
    const src = ler(arq);
    assert.match(src, new RegExp(`admin\\.rpc\\("${rpc}"`), `${arq} chama ${rpc} pelo cliente admin`);
    assert.doesNotMatch(src, new RegExp(`supabase\\.rpc\\("${rpc}"`));
  }
});
