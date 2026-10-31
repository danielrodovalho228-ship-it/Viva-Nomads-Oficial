/*
  0271 — prova ao vivo do E289, grupo da avaliação (autorizada pelo Muse em 31/10 com dados de TESTE e VISTORIA_ATIVA
  desligada): uma visita AGENDADA para o dia seguinte, no anúncio de teste pausado, com o avaliador e a moradora de
  teste. A rotina horária manda o lembrete da véspera às três partes (o mesmo filtro que o servidor usa).
  Roda: node --test src/lib/qa/massa-vistoria-e289.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { visitaAmanha } from "../vistoria/regras.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const PEDIDO = "a0271000-0000-4000-8000-000000000001";

test("0271: só contas e anúncio de teste, avaliador de teste, sem pedido aberto antes, teste = true", () => {
  for (const sql of [ler("supabase/migrations/0271_qa_massa_vistoria_e289.sql"), ler("supabase/producao/aplicar-0271.sql")]) {
    assert.match(sql, /lower\(email\) = 'proprietario1@vivanomads\.com\.br' and is_teste/);
    assert.match(sql, /lower\(email\) = 'cadastro1@vivanomads\.com\.br' and is_teste/);
    assert.match(sql, /owner_id = v_dono and title like '\[TESTE QA%' and status = 'paused'/);
    assert.match(sql, /numero_credenciado = 'UDI-002' and status in \('ativo', 'em_teste'\)/);
    assert.match(sql, /property_id = c_imovel and status in \('pedido', 'designado', 'agendado'\)/);
    assert.match(sql, new RegExp(`c_pedido constant uuid := '${PEDIDO}'`));
    // Agendada, ocupada com a concordância, para o dia seguinte às 10:00 de Brasília (depois das 21:00, o outro dia).
    assert.match(sql, /'agendado', v_avaliador/);
    assert.match(sql, /v_dia := \(\(now\(\) at time zone 'America\/Sao_Paulo'\) \+ interval '3 hours'\)::date \+ 1;/);
    assert.match(sql, /\(v_dia \+ time '10:00'\) at time zone 'America\/Sao_Paulo', true, v_morador/);
    assert.match(sql, /now\(\) - interval '1 day', true\);/);
    const codigo = sql.replace(/--[^\n]*/g, "");
    assert.doesNotMatch(codigo, /vistoria_ativa|d5d50247|automacoes|update public\.|delete from/i);
  }
});

test("o filtro do servidor pega a visita: no dia anterior ela é 'amanhã'; no próprio dia, não", () => {
  // Aplicada em 31/10 às 16:40 de Brasília → visita em 01/11 às 10:00 de Brasília (13:00 UTC).
  assert.equal(visitaAmanha("2026-11-01T13:00:00Z", "2026-10-31"), true);
  assert.equal(visitaAmanha("2026-11-01T13:00:00Z", "2026-11-01"), false);
  // O lembrete vai para as três partes, uma vez só (lembrete_d1_em).
  const servidor = ler("src/lib/vistoria/servidor.ts");
  for (const quem of [/avisar\(admin, v\.owner_id, "vistoria_lembrete"/, /parceiros\?\.user_id, "vistoria_lembrete"/, /avisar\(admin, v\.morador_id, "vistoria_lembrete"/]) assert.match(servidor, quem);
  assert.match(servidor, /\.is\("lembrete_d1_em", null\)/);
});

test("0271: aplicar entre begin/commit e registrado; rollback pelo id; roteiro com o que conferir", () => {
  const aplicar = ler("supabase/producao/aplicar-0271.sql");
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /^commit;$/m);
  assert.match(aplicar, /'20261031000271', '0271_qa_massa_vistoria_e289'/);
  const volta = ler("supabase/producao/rollback/0271_rollback.sql");
  assert.match(volta, new RegExp(`delete from public\\.vistoria_pedidos where id = '${PEDIDO}';`));
  assert.match(volta, /delete from supabase_migrations\.schema_migrations where version = '20261031000271';/);
  const doc = ler("docs/qa-prova-e289-vistoria.md");
  assert.match(doc, /VISTORIA_ATIVA` \*\*desligada\*\*/);
  assert.match(doc, /vistoria_lembrete/);
});
