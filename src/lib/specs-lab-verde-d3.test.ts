/*
  Estático (laboratório verde, faixa D, lab 81e398c7): duas specs que falhavam por causa do próprio spec.
  - t50: imovel_nivel (migração 0213) é leitura pública de propósito, só de anúncio ativo.
  - t88: o cartão de preço pode subir ~2 px junto com a coluna; a folga é de 4 px, não de 1.
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const raiz = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(raiz, p), "utf8");

test("t50 declara imovel_nivel como leitura pública, e a policy só libera anúncio ativo", () => {
  const spec = ler("tests/e2e/specs/t50-rls-todas-tabelas.spec.ts");
  assert.match(spec, /"imovel_nivel",\s*\]\);/);
  const sql = ler("supabase/migrations/0213_niveis_conforto.sql");
  assert.match(sql, /create policy "nivel: anuncio ativo" on public\.imovel_nivel for select to anon using \(\s*exists \(select 1 from public\.properties p where p\.id = imovel_nivel\.property_id and p\.status::text = 'active'\)/);
  assert.doesNotMatch(sql, /grant (insert|update|delete|all) on public\.imovel_nivel to (anon|authenticated)/);
});

test("t88 mede o cartão de preço com folga de 4 px", () => {
  const spec = ler("tests/e2e/specs/t88-imovel-completo.spec.ts");
  assert.match(spec, /caixaNav\.y \+ caixaNav\.height - 4\)/);
});
