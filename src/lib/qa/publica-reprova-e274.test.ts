/*
  0270 — E274 (decisão do Muse, 31/10): a migração publica o anúncio da reprova e grava na fila dos proativos a MESMA
  linha que a publicação pela tela grava (avisarPedidosDoImovel → enfileirarProativo), para o despacho diário mandar o
  cartão do #1682. Só contas de teste; não toca dado real, o contrato-semente nem AUTOMACOES_ATIVO.
  Roda: node --test src/lib/qa/publica-reprova-e274.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chaveProativo } from "../notifications/proativos.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const IMOVEL = "a0269000-0000-4000-8000-000000000001";

test("0270: só contas de teste, o anúncio da 0269 e o pedido ativo da inquilino2", () => {
  for (const sql of [ler("supabase/migrations/0270_qa_publica_reprova_e274.sql"), ler("supabase/producao/aplicar-0270.sql")]) {
    assert.match(sql, /lower\(email\) = 'proprietario1@vivanomads\.com\.br' and is_teste/);
    assert.match(sql, /lower\(email\) = 'inquilino2@vivanomads\.com\.br' and is_teste/);
    assert.match(sql, new RegExp(`c_imovel constant uuid := '${IMOVEL}'`));
    assert.match(sql, /owner_id = v_dono and title = '\[TESTE QA\] Proativo E274 C'/);
    assert.match(sql, /id = '9ae996c8-058b-4a84-8c88-1564112bcc2d' and inquilino_id = v_inq and status = 'ativo'/);
    // Publica como o Publicar (status active, draft_data zerado), só se ainda é rascunho.
    assert.match(sql, /status = 'active',\s+draft_data = null\s+where id = c_imovel and status = 'draft';/);
    // Nada de dado real, do contrato-semente, das automações nem do pedido.
    const codigo = sql.replace(/--[^\n]*/g, "");
    assert.doesNotMatch(codigo, /d5d50247|automacoes|update public\.pedidos_moradia|delete from/i);
  }
});

test("0270: a linha da fila é a mesma do servidor (evento, ref, chave de chaveProativo e o pedido no extra)", () => {
  const sql = ler("supabase/migrations/0270_qa_publica_reprova_e274.sql");
  assert.match(sql, /'pedido_imovel_novo', c_imovel, 'proativo:pedido_imovel_novo:' \|\| v_inq::text \|\| ':' \|\| c_imovel::text/);
  assert.match(sql, /jsonb_build_object\('pedido_id', v_pedido\)/);
  assert.match(sql, /on conflict \(chave\) do nothing;/);
  // A chave montada no SQL é a de chaveProativo (sem ciclo).
  assert.equal(chaveProativo("U", "pedido_imovel_novo", IMOVEL), `proativo:pedido_imovel_novo:U:${IMOVEL}`);
  // E é a mesma chamada que a publicação pela tela faz.
  assert.match(ler("src/lib/data/pedidos-compat.ts"), /enfileirarProativo\(admin, \{ usuarioId: pedido\.inquilino_id, evento: "pedido_imovel_novo", refId: imovelId, extra: \{ pedido_id: pedido\.id \} \}\)/);
});

test("0270: aplicar entre begin/commit e registrado; rollback volta a rascunho e tira só o cartão não enviado", () => {
  const aplicar = ler("supabase/producao/aplicar-0270.sql");
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /^commit;$/m);
  assert.match(aplicar, /'20261031000270', '0270_qa_publica_reprova_e274'/);
  const volta = ler("supabase/producao/rollback/0270_rollback.sql");
  assert.match(volta, new RegExp(`ref_id = '${IMOVEL}' and enviado_em is null`));
  assert.match(volta, new RegExp(`set status = 'draft' where id = '${IMOVEL}' and status = 'active'`));
  assert.match(volta, /delete from supabase_migrations\.schema_migrations where version = '20261031000270';/);
});
