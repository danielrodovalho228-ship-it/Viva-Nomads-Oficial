/*
  E660 — a ficha "o que tem dentro" entra no fluxo: grava na criação e na edição (só quando enviada), congela na 1ª assinatura
  do contrato (uma vez), é obrigatória para publicar anúncio novo e a migração 0316 segue o padrão (aplicar + rollback).
  Roda: node --test src/lib/data/e660-ficha-guardas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const acoes = ler("./actions.ts");
const assinar = ler("./contrato-assinar-actions.ts");
const pagina = ler("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx");

test("grava a ficha na criação e na edição; sem ficha no envio não apaga a existente", () => {
  assert.match(acoes, /await gravarFichaDentro\(supabase, user\.id, data\.id as string, input\.fichaDentro\);/);
  assert.match(acoes, /await gravarFichaDentro\(supabase, user\.id, id, input\.fichaDentro\);/);
  assert.match(acoes, /if \(bruto === undefined\) return;/);
  assert.match(acoes, /update\(\{ ficha_dentro: ficha \}\)\.eq\("id", propertyId\)\.eq\("owner_id", ownerId\)/);
});

test("a 1ª assinatura congela a ficha uma vez só, antes de qualquer assinatura", () => {
  assert.match(assinar, /if \(c\) await congelarFichaDentro\(admin, c\);/);
  assert.match(assinar, /if \(c\.assinado_proprietario_em \|\| c\.assinado_inquilino_em \|\| !c\.property_id\) return;/);
  assert.match(assinar, /\.update\(\{ ficha_dentro_congelada: congelarFicha\(ficha, new Date\(\)\) \}\)\s*\.eq\("id", c\.id\)\s*\.is\("ficha_dentro_congelada", null\)/);
  // A leitura do contrato para assinar não depende da 0316 (coluna lida à parte).
  assert.ok(!/COLUNAS =\s*"[^"]*ficha_dentro/.test(assinar));
});

test("publicar anúncio novo exige a ficha completa; rascunho e edição de anúncio antigo seguem livres", () => {
  assert.match(pagina, /if \(!asDraft && !editingId && !fichaCompleta\(fichaDentro\)\) \{/);
  assert.match(pagina, /<FichaDentroCampos ficha=\{fichaDentro\}/);
  assert.match(pagina, /fichaDentro,\n/);
});

test("migração 0316: colunas aditivas, aplicar idempotente com registro e rollback", () => {
  const mig = ler("../../../supabase/migrations/0316_ficha_dentro_e660.sql");
  assert.match(mig, /alter table public\.properties add column if not exists ficha_dentro jsonb;/);
  assert.match(mig, /alter table public\.contratos add column if not exists ficha_dentro_congelada jsonb;/);
  const ap = ler("../../../supabase/producao/aplicar-0316.sql");
  assert.match(ap, /^begin;/m);
  assert.match(ap, /'0316_ficha_dentro_e660'/);
  assert.match(ap, /where not exists/);
  assert.match(ap, /commit;\s*$/);
  assert.ok(existsSync(new URL("../../../supabase/producao/rollback/0316_rollback.sql", import.meta.url)));
});
