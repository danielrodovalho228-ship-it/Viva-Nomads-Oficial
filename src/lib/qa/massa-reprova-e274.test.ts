/*
  0269 — massa da REPROVA ao vivo do E274 (QA do Muse, 31/10): um rascunho publicável NOVO do proprietario1, compatível
  com o pedido da inquilino2 (9ae996c8…: Uberlândia, até R$ 4.000/mês, 3 meses a partir de 15/12/2026). Imóvel novo
  porque a fila dos proativos não repete o mesmo imóvel para a mesma pessoa (A e B da 0263 já foram). Nunca publicado
  pela migração: o QA publica pela tela e o e-mail "pedido_imovel_novo" sai com o cartão do #1682.
  Roda: node --test src/lib/qa/massa-reprova-e274.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("0269: só a conta de teste, 1 rascunho novo de id fixo, compatível com o pedido, com fotos, documento e tipoEntrada", () => {
  const mig = ler("supabase/migrations/0269_qa_rascunho_reprova_e274.sql");
  const aplicar = ler("supabase/producao/aplicar-0269.sql");
  for (const sql of [mig, aplicar]) {
    assert.match(sql, /lower\(email\) = 'proprietario1@vivanomads\.com\.br' and is_teste/);
    assert.match(sql, /c_imoveis constant uuid\[\] := array\['a0269000-0000-4000-8000-000000000001'\]::uuid\[\];/);
    assert.match(sql, /'\[TESTE QA\] Proativo E274 C'/);
    assert.match(sql, /for i in 1\.\.1 loop/);
    // Imóvel NOVO: nem A nem B da 0263 (a fila não repete o mesmo imóvel para a mesma pessoa).
    assert.doesNotMatch(sql, /a0263000/);
    // Compatível: Uberlândia, 2 quartos, R$ 3.200 + R$ 150 (≤ R$ 4.000), 30–180 dias, sem data de início/fim.
    assert.match(sql, /values \(v_imovel, v_dono, 'draft', v_titulo, 'Uberlândia', v_bairro, 2, 1, 4, 62,\s*3200, 'fixed', 150, 30, 180,/);
    assert.match(sql, /'availableFrom', '', 'availableUntil', ''/);
    // L-79: a resposta do Passo 6 já no rascunho.
    assert.match(sql, /'tipoEntrada', 'porteiro'/);
    // Nunca publica e não toca o pedido, a fila, as automações nem o D-5.
    assert.doesNotMatch(sql, /'active'|pedidos_moradia|emails_proativos|automacoes|d5d50247/i);
    assert.doesNotMatch(sql, /update public\./);
    assert.match(sql, /continue when exists \(select 1 from public\.properties where id = v_imovel\);/);
    assert.match(sql, /where f\.property_id = c_fonte_fotos and p\.owner_id = v_dono/);
    assert.match(sql, /'approved', now\(\), v_fonte\.document_reviewed_by, 'pending'\);/);
  }
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /^commit;$/m);
  assert.match(aplicar, /'20261031000269', '0269_qa_rascunho_reprova_e274'/);
  const volta = ler("supabase/producao/rollback/0269_rollback.sql");
  assert.match(volta, /delete from public\.properties where id = 'a0269000-0000-4000-8000-000000000001';/);
  assert.match(volta, /delete from supabase_migrations\.schema_migrations where version = '20261031000269';/);
  assert.doesNotMatch(volta, /storage\./);
});
