/*
  0263 — massa da prova ao vivo do E264-B (QA do Muse, 30/10): dois rascunhos publicáveis do proprietario1, compatíveis
  com o pedido da inquilino2 (Uberlândia, 2 quartos, até R$ 4.000/mês, 3 meses a partir de 15/12/2026), com as fotos do
  anúncio da prova de publicação (0259) e o documento aprovado. Nunca publicados pela fixture: o QA publica pela tela.
  Roda: node --test src/lib/qa/massa-proativos-e264.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("0263: só a conta de teste, 2 rascunhos de ids fixos, compatíveis com o pedido e com o documento aprovado", () => {
  const mig = ler("supabase/migrations/0263_qa_rascunhos_proativos.sql");
  const aplicar = ler("supabase/producao/aplicar-0263.sql");
  for (const sql of [mig, aplicar]) {
    assert.match(sql, /lower\(email\) = 'proprietario1@vivanomads\.com\.br' and is_teste/);
    assert.match(sql, /'a0263000-0000-4000-8000-000000000001', 'a0263000-0000-4000-8000-000000000002'/);
    assert.match(sql, /'\[TESTE QA\] Proativo E264 A', '\[TESTE QA\] Proativo E264 B'/);
    // Compatível: Uberlândia, 2 quartos, R$ 3.200 + R$ 150 (≤ R$ 4.000), 30–180 dias, sem data de início/fim.
    assert.match(sql, /values \(v_imovel, v_dono, 'draft', v_titulo, 'Uberlândia', v_bairro, 2, 1, 4, 62,\s*3200, 'fixed', 150, 30, 180,/);
    assert.match(sql, /'availableFrom', '', 'availableUntil', ''/);
    assert.ok(3200 + 150 <= 4000);
    // Nunca publica (o e-mail ao morador sai da PUBLICAÇÃO pela tela) e não toca o pedido, as automações nem o D-5.
    assert.doesNotMatch(sql, /'active'|pedidos_moradia|emails_proativos|automacoes|d5d50247/i);
    assert.doesNotMatch(sql, /update public\./);
    // Repetir não duplica.
    assert.match(sql, /continue when exists \(select 1 from public\.properties where id = v_imovel\);/);
    // As fotos são do anúncio de teste da 0259 do MESMO dono; o documento, o critério da 0259.
    assert.match(sql, /where f\.property_id = c_fonte_fotos and p\.owner_id = v_dono/);
    assert.match(sql, /q\.owner_id = v_dono[\s\S]*q\.document_status = 'approved'[\s\S]*q\.document_eliminado_em is null/);
    assert.match(sql, /'approved', now\(\), v_fonte\.document_reviewed_by, 'pending'\);/);
  }
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /^commit;$/m);
  assert.match(aplicar, /'20261030000263', '0263_qa_rascunhos_proativos'/);
  const volta = ler("supabase/producao/rollback/0263_rollback.sql");
  assert.match(volta, /delete from public\.properties where id in \('a0263000-0000-4000-8000-000000000001', 'a0263000-0000-4000-8000-000000000002'\);/);
  assert.match(volta, /delete from supabase_migrations\.schema_migrations where version = '20261030000263';/);
  assert.doesNotMatch(volta, /storage\./, "os arquivos são do anúncio da 0259 e do outro anúncio de teste");
});
