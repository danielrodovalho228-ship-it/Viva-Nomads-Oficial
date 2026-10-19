import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CORPO_MAX, mascararDestinatario, montarRegistroEmailTeste } from "./caixa-teste.ts";

// Ordem 7436a29a item 4: caixa de e-mails de teste, lida em /admin/emails-teste.
const ler = (p: string) => readFileSync(p, "utf8");

test("destinatário sempre mascarado, nunca o e-mail completo", () => {
  assert.equal(mascararDestinatario("ana.souza@lab.vivanomads.test"), "a•••@lab.vivanomads.test");
  for (const ruim of ["", "   ", "sem-arroba", "@dominio.com", "fim@", null, undefined]) assert.equal(mascararDestinatario(ruim), "•••");
});

test("registro: corta tamanhos, tira controle e só aceita uuid válido", () => {
  const r = montarRegistroEmailTeste({ evento: "chamado_respondido", assunto: "Oi\u0000", texto: "x".repeat(CORPO_MAX + 500), para: "a@b.com", usuarioId: "não-é-uuid" });
  assert.equal(r.assunto, "Oi");
  assert.equal(r.corpo.length, CORPO_MAX);
  assert.equal(r.usuario_id, null);
  assert.equal(r.destinatario_mascarado, "a•••@b.com");
  assert.ok(!JSON.stringify(r).includes("a@b.com"));
  const ok = montarRegistroEmailTeste({ evento: "e", assunto: "a", texto: "t", para: "x@y.com", usuarioId: "11111111-1111-4111-8111-111111111111" });
  assert.equal(ok.usuario_id, "11111111-1111-4111-8111-111111111111");
});

test("a caixa é gravada só pelo servidor (dentro do sendEmail) e sem derrubar o envio", () => {
  const n = ler("src/lib/notifications/email.ts");
  assert.match(n, /await guardarSeContaDeTeste\(p\)/);
  const s = ler("src/lib/notifications/caixa-teste.ts");
  assert.match(s, /\.eq\("is_teste", true\)/);
  assert.ok(!/\.ilike\(/.test(s), "ilike trata _ do e-mail como curinga");
  assert.match(s, /catch \{\s*return false;/);
  assert.match(ler("src/lib/notifications/caixa-teste-servidor.ts"), /catch \{\s*return false;/);
});

test("0136: tabela com RLS (só admin lê, ninguém grava pela API) + aplicar idempotente + rollback", () => {
  const m = ler("supabase/migrations/0136_emails_teste.sql");
  assert.match(m, /create table if not exists public\.emails_teste/);
  assert.match(m, /enable row level security/);
  assert.match(m, /for select to authenticated/);
  assert.match(m, /p\.role = 'admin'/);
  assert.match(m, /\(select auth\.uid\(\)\)/);
  assert.ok(!/for (insert|update|delete|all)/i.test(m), "sem política de escrita: só o servidor grava");
  const a = ler("supabase/producao/aplicar-0136.sql");
  assert.match(a, /^begin;/m);
  assert.match(a, /commit;\s*$/);
  assert.match(a, /20261016000136/);
  assert.match(a, /where not exists \(select 1 from supabase_migrations\.schema_migrations/);
  assert.match(ler("supabase/producao/rollback/0136_rollback.sql"), /drop table if exists public\.emails_teste/);
});

test("a tela /admin/emails-teste existe, está no menu e nos atalhos do admin", () => {
  const p = ler("src/app/(dashboard)/admin/emails-teste/page.tsx");
  assert.match(p, /PageTitle/);
  assert.match(p, /md:hidden/);
  assert.match(p, /hidden md:block/);
  assert.match(ler("src/config/menu-painel.ts"), /href: "\/admin\/emails-teste"/);
  assert.match(ler("src/app/(dashboard)/admin/atalhos-admin.tsx"), /\/admin\/emails-teste/);
});
