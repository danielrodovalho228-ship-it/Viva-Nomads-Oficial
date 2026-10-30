/*
  0259 — massa da prova final do cadastro (QA do Muse, 30/10): rascunho vazio "[TESTE QA] Prova de publicação" do
  proprietario1 com o documento do imóvel já aprovado. Só conta de teste, ids fixos, nada além do rascunho e da
  qualificação dele (sem fotos, conforto, preço ou status ativo: isso o QA faz na tela).
  Roda: node --test src/lib/qa/massa-prova-publicacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("0259: só a conta de teste, rascunho vazio com ids fixos e o documento aprovado de um anúncio de teste do mesmo dono", () => {
  const mig = ler("supabase/migrations/0259_qa_rascunho_prova_publicacao.sql");
  const aplicar = ler("supabase/producao/aplicar-0259.sql");
  for (const sql of [mig, aplicar]) {
    assert.match(sql, /lower\(email\) = 'proprietario1@vivanomads\.com\.br' and is_teste/);
    assert.match(sql, /c_imovel constant uuid := 'a0259000-0000-4000-8000-000000000001'/);
    assert.match(sql, /c_titulo constant text := '\[TESTE QA\] Prova de publicação'/);
    // Rascunho vazio (como o autosave deixa um anúncio recém-aberto), nunca publicado pela fixture.
    assert.match(sql, /values \(c_imovel, v_dono, 'draft', c_titulo, 'Uberlândia', 0, '', jsonb_build_object\('title', c_titulo\)\)/);
    assert.doesNotMatch(sql, /'active'|property_photos|conforto_declaracoes|update public\.properties|update public\.qualification_checklists/);
    // O arquivo vem de um anúncio de TESTE do mesmo dono, aprovado e não eliminado; a linha nova nasce aprovada.
    assert.match(sql, /q\.owner_id = v_dono[\s\S]*q\.document_status = 'approved'[\s\S]*q\.document_eliminado_em is null[\s\S]*p\.title ~\* '\^\\s\*\\\[\\s\*\(teste\|test\|qa\)\\y'/);
    assert.match(sql, /'approved', now\(\), v_fonte\.document_reviewed_by, 'pending'\);/);
  }
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /^commit;$/m);
  assert.match(aplicar, /'20261030000259', '0259_qa_rascunho_prova_publicacao'/);
  const volta = ler("supabase/producao/rollback/0259_rollback.sql");
  assert.match(volta, /delete from public\.properties where id = 'a0259000-0000-4000-8000-000000000001';/);
  assert.match(volta, /delete from supabase_migrations\.schema_migrations where version = '20261030000259';/);
  // O desfazer não apaga o arquivo do documento (é do outro anúncio de teste).
  assert.doesNotMatch(volta, /storage\./);
});
