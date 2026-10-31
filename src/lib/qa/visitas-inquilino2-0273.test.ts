/*
  0273 — massa de visitas da inquilino2 (pedido do Muse, 31/10): uma presencial confirmada que já passou e uma por
  vídeo confirmada no futuro, num anúncio de teste do proprietario1. Só contas de teste e sem e-mail.
  Roda: node --test src/lib/qa/visitas-inquilino2-0273.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("0273: só contas de teste, ids fixos, as duas visitas confirmadas e a véspera marcada como enviada", () => {
  for (const sql of [ler("supabase/migrations/0273_qa_visitas_inquilino2.sql"), ler("supabase/producao/aplicar-0273.sql")]) {
    assert.match(sql, /lower\(email\) = 'proprietario1@vivanomads\.com\.br' and is_teste/);
    assert.match(sql, /lower\(email\) = 'inquilino2@vivanomads\.com\.br' and is_teste/);
    assert.match(sql, /'a0273000-0000-4000-8000-000000000001'/);
    assert.match(sql, /'a0273000-0000-4000-8000-000000000002'/);
    assert.match(sql, /c_passada, c_imovel, v_dono, v_morador, 'presencial', array\['2026-10-30 13:00:00\+00'\]/);
    assert.match(sql, /c_futura, c_imovel, v_dono, v_morador, 'video'/);
    assert.match(sql, /'https:\/\/meet\.google\.com\//);
    assert.match(sql, /'visita_vespera:' \|\| c_futura \|\| ':' \|\| u \|\| ':' \|\| c_futura_txt/);
    const codigo = sql.replace(/--[^\n]*/g, "");
    assert.doesNotMatch(codigo, /d5d50247|automacoes_ativo|vistoria_ativa|emails_proativos|update public\.|delete from/i);
  }
  const aplicar = ler("supabase/producao/aplicar-0273.sql");
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /^commit;$/m);
  assert.match(aplicar, /'20261031000273', '0273_qa_visitas_inquilino2'/);
  const rollback = ler("supabase/producao/rollback/0273_rollback.sql");
  assert.match(rollback, /delete from public\.visitas_video where id in \('a0273000-0000-4000-8000-000000000001', 'a0273000-0000-4000-8000-000000000002'\);/);
  assert.match(rollback, /delete from public\.automacoes_envios where chave like 'visita_vespera:a0273000-/);
  assert.match(rollback, /version = '20261031000273'/);
});

test("0273: a chave gravada é a mesma que o servidor monta para a véspera (CHAVE_VESPERA)", () => {
  const servidor = ler("src/lib/visitas/avisos-servidor.ts");
  assert.match(servidor, /CHAVE_VESPERA = \(visitaId: string, usuarioId: string, horario: string\) => `visita_vespera:\$\{visitaId\}:\$\{usuarioId\}:\$\{horario\}`/);
});
