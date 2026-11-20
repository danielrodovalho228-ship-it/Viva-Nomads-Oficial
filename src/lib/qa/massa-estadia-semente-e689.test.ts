/*
  E689 (auditoria E683, P5) — estadias-semente com os gatilhos na janela, para provar numa tacada só: jornada de e-mails
  (E663: chegada, meio, semana da saída), emergência no dia da chegada (E664) e pedidos de limpeza vinculados à estadia.
  Só contas de teste e anúncios [TESTE QA] novos e pausados; não toca contrato-semente, AUTOMACOES_ATIVO nem dado real.
  Roda: node --test src/lib/qa/massa-estadia-semente-e689.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { momentosDeHoje } from "../estadia/jornada-mensagens.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const MIG = "supabase/migrations/0327_qa_estadia_semente_e689.sql";
const APLICAR = "supabase/producao/aplicar-0327.sql";

test("as datas da massa: cada estadia cai em UM momento da jornada no dia ALVO", () => {
  const alvo = "2026-11-10";
  const soma = (n: number) => new Date(Date.parse(`${alvo}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  assert.deepEqual(momentosDeHoje({ entrada: soma(0), fim: soma(30), hoje: alvo }), ["jornada_chegada"]);
  assert.deepEqual(momentosDeHoje({ entrada: soma(-30), fim: soma(30), hoje: alvo }), ["jornada_meio_estadia"]);
  assert.deepEqual(momentosDeHoje({ entrada: soma(-23), fim: soma(7), hoje: alvo }), ["jornada_semana_saida"]);
});

test("0327: só contas de teste, anúncios [TESTE QA] novos e pausados, 1º pagamento confirmado, pedidos vinculados ao contrato", () => {
  for (const sql of [ler(MIG), ler(APLICAR)]) {
    assert.match(sql, /lower\(email\) = 'proprietario1@vivanomads\.com\.br' and is_teste/);
    assert.match(sql, /lower\(email\) = 'cadastro1@vivanomads\.com\.br' and is_teste/);
    assert.match(sql, /'paused', '\[TESTE QA\] Estadia-semente E689 chegada'/);
    assert.match(sql, /'paused', '\[TESTE QA\] Estadia-semente E689 meio'/);
    assert.match(sql, /'paused', '\[TESTE QA\] Estadia-semente E689 saída'/);
    // Datas: chegada = ALVO; meio = 60 dias com o ponto médio em ALVO; semana da saída = fim em ALVO+7.
    assert.match(sql, /daterange\(v_alvo, v_alvo \+ 30, '\[\)'\)/);
    assert.match(sql, /daterange\(v_alvo - 30, v_alvo \+ 30, '\[\)'\)/);
    assert.match(sql, /daterange\(v_alvo - 23, v_alvo \+ 7, '\[\)'\)/);
    // O 1º pagamento do aluguel confirmado pelo inquilino (condição da chegada e da semana da saída).
    assert.match(sql, /insert into public\.pagamentos_bloco[\s\S]*'aluguel'[\s\S]*true/);
    // Pedidos de limpeza (pré-chegada e saída) amarrados ao contrato, do parceiro de teste do E213.
    assert.match(sql, /parceiro_pedidos[\s\S]*contrato_id[\s\S]*'limpeza'/);
    assert.match(sql, /a0261000-0000-4000-8000-000000000011/);
    assert.match(sql, /VN-SV-E689[A-C]327/);
    const codigo = sql.replace(/--[^\n]*/g, "");
    assert.doesNotMatch(codigo, /d5d50247|automacoes_envios|AUTOMACOES_ATIVO|CAUCAO_PRAZOS|delete from/i);
  }
});

test("0327: aplicar entre begin/commit e registrado; rollback pelos ids fixos", () => {
  const aplicar = ler(APLICAR);
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /^commit;$/m);
  assert.match(aplicar, /'20261107000327', '0327_qa_estadia_semente_e689'/);
  const volta = ler("supabase/producao/rollback/0327_rollback.sql");
  assert.match(volta, /delete from public\.contratos where id in/);
  assert.match(volta, /delete from public\.properties where id in/);
  assert.match(volta, /delete from supabase_migrations\.schema_migrations where version = '20261107000327';/);
});
