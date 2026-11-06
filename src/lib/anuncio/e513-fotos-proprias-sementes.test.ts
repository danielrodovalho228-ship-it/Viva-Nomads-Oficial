/*
  E513 (prova ao vivo de 05/11): os anúncios-semente da conta de teste compartilhavam as mesmas fotos (massa, não
  renderização). A 0302 dá a cada um as próprias 8, só quando há imagens distintas livres.
  Roda: node --test src/lib/anuncio/e513-fotos-proprias-sementes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const mig = ler("supabase/migrations/0302_qa_fotos_proprias_sementes_e513.sql");

test("E513: 0302 cobre as 8 sementes e só age com imagens distintas suficientes (senão não muda nada)", () => {
  assert.equal((mig.match(/'a02[0-9a-f]{5}-0000-4000-8000-0000000000\d\d'/g) ?? []).length, 8);
  assert.match(mig, /array_length\(v_livres, 1\), 0\) < array_length\(v_existentes, 1\) \* v_por_semente/);
  assert.match(mig, /Nada alterado/);
  assert.match(mig, /v_por_semente constant int := 8/);
});

test("E513: imagens distintas por conteúdo, só da conta de teste, fora das usadas por anúncios não-semente; cada uma em UMA semente", () => {
  assert.match(mig, /distinct on \(o\.metadata ->> 'eTag'\)/);
  assert.match(mig, /o\.name like v_dono::text \|\| '\/%'/);
  assert.match(mig, /not \(p\.id = any \(v_sementes\)\)/);
  assert.match(mig, /v_livres\[\(v_i - 1\) \* v_por_semente \+ v_k\]/); // fatias disjuntas
});

test("E513: o aplicar-0302 embrulha o mesmo corpo, se registra e tem rollback; nada de pausados sem foto", () => {
  const ap = ler("supabase/producao/aplicar-0302.sql");
  assert.match(ap, /^-- [^\n]*\nbegin;|\nbegin;\nset local lock_timeout = '5s';/);
  assert.ok(ap.includes(mig.trim()));
  assert.match(ap, /'20261105000302', '0302_qa_fotos_proprias_sementes_e513'/);
  assert.match(ap, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261105000302'\)/);
  assert.match(ler("supabase/producao/rollback/0302_rollback.sql"), /version = '20261105000302'/);
  assert.doesNotMatch(mig, /update public\.properties|delete from public\.properties/);
});
