/*
  E513 (reprovado de novo em 05/11): "Resumo semanal 0276 A/B" e "Proativo E274 C" seguiam com o MESMO arquivo de foto principal.
  A 0302 só trocava vínculos e exigia 64 imagens distintas livres (a pasta tem 52 distintas, 16 livres): saía sem mudar nada.
  A 0312 usa o que existe: floor(livres / 8) imagens PRÓPRIAS por semente no topo da galeria — a principal é sempre só dela.
  (A lógica foi rodada num Postgres local com o retrato de produção: 8 principais distintas, 8 fotos sem repetição por semente,
  mesmo resultado na 2ª aplicação, fotos dos outros anúncios intactas.)
  Roda: node --test src/lib/anuncio/e513-principal-distinta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const mig = ler("supabase/migrations/0312_qa_fotos_principais_distintas_e513.sql");

test("E513: a 0312 cobre as mesmas 8 sementes da 0302", () => {
  const ids = (s: string) => [...s.matchAll(/'(a02[0-9a-f]{5}-0000-4000-8000-0000000000\d\d)'/g)].map((m) => m[1]).sort();
  assert.equal(ids(mig).length, 8);
  assert.deepEqual(ids(mig), ids(ler("supabase/migrations/0302_qa_fotos_proprias_sementes_e513.sql")));
});

test("E513: adaptativa — conteúdo distinto (eTag), livres de anúncio não-semente, uma fatia por semente, e nada muda sem uma imagem por semente", () => {
  assert.match(mig, /distinct on \(o\.metadata ->> 'eTag'\)/);
  assert.match(mig, /not \(p\.id = any \(v_sementes\)\)/);
  assert.match(mig, /v_proprias := least\(v_total, coalesce\(array_length\(v_livres, 1\), 0\) \/ array_length\(v_existentes, 1\)\)/);
  assert.match(mig, /v_livres\[\(v_i - 1\) \* v_proprias \+ 1 : v_i \* v_proprias\]/); // fatias disjuntas
  assert.match(mig, /if v_proprias < 1 then/);
  assert.match(mig, /Nada alterado/);
  // a principal (sort_order 0) é a 1ª imagem própria; o resto vem depois, sem repetir arquivo
  assert.match(mig, /v_k - 1\);/);
  assert.match(mig, /v_proprias \+ v_k - 1/);
  assert.match(mig, /f\.nome <> all \(/);
});

test("E513: só mexe em property_photos das sementes (nunca em properties) e é determinística para ser idempotente", () => {
  assert.doesNotMatch(mig, /update public\.properties|delete from public\.properties|insert into public\.properties/);
  assert.match(mig, /delete from public\.property_photos where property_id = v_existentes\[v_i\]/);
  assert.match(mig, /array_agg\(nome order by nome\)/);
});

test("E513: o aplicar-0312 embrulha o mesmo corpo, se registra como 0312 e tem rollback", () => {
  const ap = ler("supabase/producao/aplicar-0312.sql");
  assert.match(ap, /\nbegin;\nset local lock_timeout = '5s';/);
  assert.ok(ap.includes(mig.trim()));
  assert.match(ap, /'20261105000312', '0312_qa_fotos_principais_distintas_e513'/);
  assert.match(ap, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261105000312'\)/);
  assert.match(ler("supabase/producao/rollback/0312_rollback.sql"), /version = '20261105000312'/);
});
