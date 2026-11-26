/*
  E1059, perna de servidor (ORDEM-DUET-433): pela inserção direta em `messages` (chave pública + sessão), o gatilho
  messages_mask_contact (0057/0287) tratava o CPF como telefone e gravava a mensagem MASCARADA. A regra para CPF/RG é
  RECUSA, nunca máscara. A migração 0354 faz o gatilho recusar a linha quando o texto traz documento (as mesmas regras
  do contact-guard.ts) e deixa a máscara do resto do contato como estava.
  Aqui: a forma da migração (o comportamento no banco está na t1727 e na t2224, no laboratório).
  Roda: node --test src/lib/messages/e1059-servidor-recusa-documento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { DOCUMENTO_BLOQUEADO } from "./contact-guard.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const MIGRACAO = "supabase/migrations/0354_mensagens_recusam_documento_e1059.sql";
const APLICAR = "supabase/producao/aplicar-0354.sql";
const ROLLBACK = "supabase/producao/rollback/0354_rollback.sql";
/** Só o SQL que executa (sem as linhas de comentário). */
const semComentarios = (sql: string) => sql.split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");

test("E1059 servidor: o gatilho das mensagens RECUSA documento, com a frase do Ocupantes, antes de mascarar", () => {
  const sql = semComentarios(ler(MIGRACAO));
  const gatilho = sql.slice(sql.indexOf("create or replace function public.trg_mask_body()"));
  assert.ok(gatilho.length > 0, "a 0354 redefine trg_mask_body");
  const recusa = gatilho.indexOf("if public.contem_documento(new.body) then");
  const mascara = gatilho.indexOf("new.body := public.mask_contact(new.body);");
  assert.ok(recusa > 0, "o gatilho pergunta se o texto traz documento");
  assert.ok(mascara > recusa, "a máscara do resto do contato vem depois da recusa e continua lá");
  assert.ok(gatilho.includes(`raise exception '${DOCUMENTO_BLOQUEADO}' using errcode = '23514';`), "a recusa do banco usa a mesma frase da tela e do servidor");
});

test("E1059 servidor: contem_documento espelha as cinco regras de documento do contact-guard.ts", () => {
  const sql = semComentarios(ler(MIGRACAO));
  const guarda = ler("src/lib/messages/contact-guard.ts");
  for (const nome of ["RG_ROTULO_RE", "CPF_ROTULO_RE", "CPF_FORMATADO_RE", "CPF_CANDIDATE_RE", "RG_MASCARA_RE"]) {
    assert.match(guarda, new RegExp(`text\\.replace\\(${nome},`), `o contact-guard.ts segue com a regra ${nome}`);
  }
  assert.match(sql, /\(\?:RG\|R\\\.G\\\.\|identidade\)/, "RG com rótulo");
  assert.match(sql, /\(\?:CPF\|C\\\.P\\\.F\\\.\?\)/, "CPF com rótulo");
  assert.ok(sql.includes(String.raw`r ~ '(?<![\d.-])\d{3}\.\d{3}\.\d{3}-\d{2}(?![\d-])'`), "CPF com a forma 000.000.000-00, mesmo com dígito verificador inválido");
  assert.ok(sql.includes("if public.cpf_valido(m) then"), "11 dígitos sem rótulo só com dígito verificador válido (um celular não é recusado)");
  assert.ok(sql.includes(String.raw`\d{1,2}\.\d{3}\.\d{3}(?:-[\dXx])?`), "RG pela máscara");
  assert.match(sql, /regexp_replace\(t, '\\y\[0-9a-f\]\{8\}-/, "ids (UUID) saem antes das regras");
  assert.match(sql, /revoke all on function public\.contem_documento\(text\) from public, anon;/);
  assert.match(sql, /grant execute on function public\.contem_documento\(text\) to authenticated, service_role;/);
});

test("E1059 servidor: a 0354 só mexe em funções — a máscara, a tabela e as políticas ficam como estão", () => {
  const sql = semComentarios(ler(MIGRACAO));
  assert.doesNotMatch(sql, /function public\.mask_contact/, "mask_contact não é redefinida");
  assert.doesNotMatch(sql, /\b(alter table|create policy|drop policy|drop trigger|create trigger|update public\.|delete from public\.|insert into public\.)/i);
});

test("E1059 servidor: aplicar-0354 é a mesma migração, entre begin e commit, e registra-se; o rollback existe", () => {
  const migracao = semComentarios(ler(MIGRACAO)).trim();
  const aplicar = ler(APLICAR);
  assert.ok(semComentarios(aplicar).includes(migracao), "o corpo do aplicar é o da migração");
  assert.match(semComentarios(aplicar).trim(), /^begin;[\s\S]*commit;$/);
  assert.ok(aplicar.includes("select '20261122000354', '0354_mensagens_recusam_documento_e1059'"));
  assert.ok(aplicar.includes("where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261122000354');"));
  assert.ok(existsSync(new URL(`../../../${ROLLBACK}`, import.meta.url)));
  const volta = semComentarios(ler(ROLLBACK));
  assert.ok(volta.includes("drop function if exists public.contem_documento(text);"));
  assert.ok(volta.includes("new.body := public.mask_contact(new.body);") && !volta.includes("contem_documento(new.body)"), "o rollback devolve o gatilho que só mascara");
});
