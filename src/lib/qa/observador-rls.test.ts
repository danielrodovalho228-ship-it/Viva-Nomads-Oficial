/*
  0253 — o admin observador da QA não escreve direto pela API nas tabelas de admin. Guarda da migração: o corpo da
  migração e o do aplicar são o mesmo; toda tabela com escrita de admin em produção (levantada em 29/10, pg_policies)
  está na lista; nada mexe em is_admin() nem na leitura. Roda: node --test src/lib/qa/observador-rls.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(`../../../${rel}`, import.meta.url), "utf8");
const migracao = ler("supabase/migrations/0253_qa_observador_sem_escrita.sql");
const aplicar = ler("supabase/producao/aplicar-0253.sql");
const rollback = ler("supabase/producao/rollback/0253_rollback.sql");
const corpo = (s: string) => s.slice(s.indexOf("do $$"), s.lastIndexOf("::text\n  );") + "::text\n  );".length);

/** Tabelas com política de escrita (insert/update/delete/all) por is_admin() em produção, fora a Caixa (0252). */
const TABELAS = {
  agentes: "insert,update,delete", agentes_conversas: "insert,update,delete", agentes_memoria: "insert,update,delete",
  agentes_ordens: "insert,update,delete", cidades_liberadas: "insert,update,delete", config_parceria: "insert,update,delete",
  destinos: "insert,update,delete", fotografo_pedidos: "update", fotografos: "insert,update,delete",
  fotografos_contato: "insert,update,delete", fotos_perfil_revisao: "update", gastos_marketing: "insert,update,delete",
  moderacao_log: "insert,update,delete", parceiros_interesse: "update", pedidos_ajuda_publicacao: "update",
  pedidos_ignorados: "insert,update,delete", pedidos_moradia: "insert,update,delete", properties: "insert,update,delete",
  qualification_checklists: "insert,update,delete", respostas_pedido: "update",
} as const;

test("a migração e o aplicar têm o mesmo corpo; o aplicar se registra como 0253 entre begin/commit", () => {
  assert.ok(corpo(migracao).length > 500);
  assert.equal(corpo(aplicar), corpo(migracao));
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /'20261029000253', '0253_qa_observador_sem_escrita'/);
  assert.match(aplicar, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261029000253'\)/);
  assert.match(aplicar.trimEnd(), /commit;$/);
});

test("toda tabela de escrita do admin está na lista, com os comandos certos", () => {
  for (const [tabela, cmds] of Object.entries(TABELAS)) {
    const linha = new RegExp(`\\('${tabela}',\\s+array\\[${cmds.split(",").map((c) => `'${c}'`).join(",")}\\]`);
    assert.match(migracao, linha, tabela);
  }
  assert.match(migracao, /qa_observador: nao apaga arquivo alheio" on storage\.objects as restrictive for delete/);
  assert.match(migracao, /bucket_id not in \('avatars', 'property-docs'\)/);
});

test("só políticas RESTRITIVAS de escrita; leitura, is_admin() e o 2FA não mudam", () => {
  assert.match(migracao, /as restrictive for %s to authenticated/);
  assert.doesNotMatch(migracao, /for select|for all/i);
  assert.doesNotMatch(migracao, /function public\.is_admin|aal2|mfa/i);
  assert.match(migracao, /not \(select public\.is_qa_admin\(\(select auth\.uid\(\)\)\)\)/);
});

test("o rollback tira só as políticas da 0253 e a linha dela", () => {
  assert.match(rollback, /policyname like 'qa_observador: nao escreve \(%\)'/);
  assert.match(rollback, /drop policy if exists "qa_observador: nao apaga arquivo alheio" on storage\.objects/);
  assert.match(rollback, /delete from supabase_migrations\.schema_migrations where version = '20261029000253'/);
  assert.doesNotMatch(rollback, /create policy/);
});
