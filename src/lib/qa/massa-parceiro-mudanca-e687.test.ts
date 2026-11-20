/*
  E687 (ramo positivo) — massa: parceiro de Mudança APROVADO em conta de teste, com empresa e veículo fictícios, para a QA
  ver a própria empresa/veículo no painel. Só dado; só conta is_teste; ids fixos a0329… (rollback).
  Roda: node --test src/lib/qa/massa-parceiro-mudanca-e687.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const MIG = "supabase/migrations/0329_qa_parceiro_mudanca_e687.sql";
const APLICAR = "supabase/producao/aplicar-0329.sql";

for (const arquivo of [MIG, APLICAR]) {
  test(`${arquivo}: só conta de teste, categoria mudanca, publicado, empresa e veículo nos dois lados`, () => {
    const sql = ler(arquivo).replace(/^\s*--.*$/gm, ""); // sem os comentários
    assert.match(sql, /lower\(email\) = 'inquilino2@vivanomads\.com\.br' and is_teste/);
    assert.match(sql, /array\['mudanca'\]/);
    assert.match(sql, /'publicado'/);
    assert.match(sql, /'ativada'/);
    assert.match(sql, /jsonb_build_object\('empresa', '\[TESTE QA\][^']+', 'veiculo', '[^']+'\)/);
    // Os mesmos dados no pedido de origem e no parceiro (a ativação do E687 os copia).
    assert.match(sql, /insert into public\.parceiro_solicitacoes[\s\S]*dados_categoria\)[\s\S]*c_dados\);/);
    assert.match(sql, /insert into public\.parceiros[\s\S]*dados_categoria\)[\s\S]*c_dados\);/);
    // Idempotente e sem tocar em nada que já existe.
    assert.match(sql, /a conta de teste já tem pedido ou parceiro; nada a fazer/);
    assert.doesNotMatch(sql, /\b(update|delete)\s+(from\s+)?public\./i);
    assert.doesNotMatch(sql, /AUTOMACOES_ATIVO|chaves_plataforma|contratos|properties/);
  });
}

test("aplicar-0329: transação, registra 20261107000329 e tem rollback pelos ids fixos", () => {
  const ap = ler(APLICAR);
  assert.match(ap, /\nbegin;[\s\S]*commit;\s*$/);
  assert.match(ap, /select '20261107000329', '0329_qa_parceiro_mudanca_e687'[\s\S]*where not exists/);
  const rb = ler("supabase/producao/rollback/0329_rollback.sql");
  for (const t of ["parceiro_servicos", "parceiros", "parceiro_solicitacoes"]) assert.match(rb, new RegExp(`delete from public\\.${t} where id = 'a0329000-`));
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261107000329'/);
});

test("o painel lê a empresa e o veículo do parceiro (o que a massa permite ver)", () => {
  const painel = ler("src/lib/parceiros/painel-actions.ts");
  assert.match(painel, /dadosCategoria: \(p\.dados_categoria as \{ empresa\?: string; veiculo\?: string \} \| null\) \?\? \{\}/);
});
