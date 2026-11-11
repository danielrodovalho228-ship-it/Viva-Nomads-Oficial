/*
  E759 (ponto 2) / E689 — migração 0337: a estadia-semente do D-7 de ENTRADA. Lê as datas do SQL (migração e aplicar) e
  roda a regra REAL da jornada (momentosDeHoje) e a condição do cron (assinada pelas duas partes + 1º pagamento).
  Roda: node --test src/lib/qa/massa-estadia-semente-d7-0337.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { momentosDeHoje } from "../estadia/jornada-mensagens.ts";
import { datasDaEstadia } from "../contrato-blocos.ts";
import { primeiroPagamentoConfirmado } from "../contrato-estado.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const MIG = "supabase/migrations/0337_qa_estadia_semente_d7_e759.sql";
const APLICAR = "supabase/producao/aplicar-0337.sql";
const ALVO = "2026-11-12";
const soma = (n: number) => new Date(Date.parse(`${ALVO}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const desloc = (s?: string) => (s ? Number(s.replace(/\s/g, "")) : 0);

for (const arquivo of [MIG, APLICAR]) {
  test(`${arquivo}: no dia ALVO (rodada do cron) a regra real da jornada dispara SÓ o jornada_d7`, () => {
    const sql = ler(arquivo);
    const m = /values \(c_bloco, c_contrato, 1, v_alvo(?: ([-+] \d+))?, v_alvo(?: ([-+] \d+))?, 1, 3200, 3200, 'avista', 'pendente', 'agendado'\)/.exec(sql);
    assert.ok(m, "bloco da massa não encontrado no SQL");
    const blocos = [{ inicio: soma(desloc(m![1])), fim: soma(desloc(m![2])), status: "agendado" }];
    const datas = datasDaEstadia(blocos);
    assert.ok(datas);
    assert.equal(datas!.entrada, soma(7), "entrada exatamente 7 dias depois da rodada do cron");
    assert.deepEqual(momentosDeHoje({ ...datas!, hoje: ALVO }), ["jornada_d7"]);
    // Nenhum outro momento da jornada cai no mesmo dia, nem o D-7 cai em outro dia da janela.
    for (const n of [-1, 1, 6]) assert.ok(!momentosDeHoje({ ...datas!, hoje: soma(n) }).includes("jornada_d7"), `sem D-7 em ALVO${n >= 0 ? "+" : ""}${n}`);
    assert.deepEqual(momentosDeHoje({ ...datas!, hoje: soma(7) }), ["jornada_chegada"]);
  });

  test(`${arquivo}: as condições do cron estão na massa (ativo, assinado pelas duas partes, 1º pagamento confirmado)`, () => {
    const sql = ler(arquivo);
    assert.match(sql, /'ativo', 'media_estadia', daterange\(v_alvo \+ 7, v_alvo \+ 37, '\[\)'\)/);
    assert.match(sql, /\(v_alvo - 5\)::timestamptz, \(v_alvo - 5\)::timestamptz\);/);
    assert.match(sql, /'aluguel', 3200, 'pix', v_alvo - 1, v_dono, true, now\(\), 'Massa de teste E759'/);
    assert.ok(primeiroPagamentoConfirmado([{ tipo: "aluguel", confirmado_pelo_inquilino: true, anulado_em: null }] as never));
    // ALVO = a próxima rodada do cron (13:00 UTC = 10:00 em Brasília): hoje antes das 09:30, senão amanhã.
    assert.match(sql, /v_alvo := v_agora::date \+ case when v_agora::time >= time '09:30' then 1 else 0 end;/);
  });

  test(`${arquivo}: só contas de teste, anúncio pausado, idempotente, sem tocar o contrato-semente nem chaves`, () => {
    const sql = ler(arquivo).replace(/^\s*--.*$/gm, "");
    assert.match(sql, /'proprietario1@vivanomads\.com\.br' and is_teste/);
    assert.match(sql, /'cadastro1@vivanomads\.com\.br' and is_teste/);
    assert.match(sql, /c_imovel, v_dono, 'paused', '\[TESTE QA\] Estadia-semente E759 D-7'/);
    assert.match(sql, /if exists \(select 1 from public\.properties where id = c_imovel\) then/);
    assert.doesNotMatch(sql, /AUTOMACOES_ATIVO|configuracoes|D5D50247/i);
    assert.doesNotMatch(sql, /\bdelete\s+from\b/i);
  });
}

test("aplicar-0337 registra a versão e o rollback desfaz só os ids fixos da massa", () => {
  assert.match(ler(APLICAR), /'20261111000337', '0337_qa_estadia_semente_d7_e759'/);
  assert.match(ler(APLICAR), /^begin;[\s\S]*commit;\s*$/m);
  const rb = ler("supabase/producao/rollback/0337_rollback.sql");
  assert.match(rb, /delete from public\.contratos where id = 'a0337d00-0000-4000-8000-000000000011';/);
  assert.match(rb, /delete from public\.properties where id = 'a0337d00-0000-4000-8000-000000000001';/);
  assert.doesNotMatch(rb, /a0327/);
});
