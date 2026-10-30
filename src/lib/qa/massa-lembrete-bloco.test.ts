/*
  0260 — massa da prova ao vivo do lembrete de início de bloco: contrato de teste com o bloco 1 terminando em 2 dias.
  Guardas: só contas e anúncio de teste, longe da seed do D-5, e nada que dispare sozinho.
  Roda: node --test src/lib/qa/massa-lembrete-bloco.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { blocoRenovado, precisaLembreteDoBloco } from "../estadia/lembrete-bloco.ts";
import { avisarRenovacao, lembreteDeSaida } from "../automacoes/regras.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const somaDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

test("0260: só contas de teste, ids fixos, fora da seed do D-5; aplicar idempotente e desfazer", () => {
  const mig = ler("supabase/migrations/0260_qa_contrato_lembrete_bloco.sql");
  const aplicar = ler("supabase/producao/aplicar-0260.sql");
  for (const sql of [mig, aplicar]) {
    assert.match(sql, /lower\(email\) = 'proprietario1@vivanomads\.com\.br' and is_teste/);
    assert.match(sql, /lower\(email\) = 'cadastro1@vivanomads\.com\.br' and is_teste/);
    assert.match(sql, /c_contrato constant uuid := 'a0260000-0000-4000-8000-000000000001'/);
    assert.match(sql, /title like '\[TESTE QA%'/);
    assert.match(sql, /from public\.imovel_parceiros where property_id = c_imovel/);
    // Nada da seed do D-5 (contrato, Premium, Ana) e nenhuma chave.
    const codigo = sql.replace(/--.*$/gm, "");
    assert.doesNotMatch(codigo, /d5d50247|330ebf37|inquilino2@|AUTOMACOES_ATIVO|automacoes_envios|emails_teste/);
    // Só o bloco 1 (sem aceite de renovação, sem bloco 2): o lembrete não tem o que mandar sozinho.
    assert.match(sql, /values \(c_bloco, c_contrato, 1, v_inicio, v_fim, 1, 3200, 3200, 'avista', 'pendente', 'ativo'\)/);
    assert.doesNotMatch(codigo, /aceite_proprietario_em|aceite_inquilino_em/);
    assert.match(sql, /v_fim date := current_date \+ 2;/);
  }
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /^commit;$/m);
  assert.match(aplicar, /'20261030000260', '0260_qa_contrato_lembrete_bloco'/);
  const volta = ler("supabase/producao/rollback/0260_rollback.sql");
  assert.match(volta, /delete from public\.contratos where id = 'a0260000-0000-4000-8000-000000000001';/);
  assert.match(volta, /delete from public\.automacoes_envios where chave like 'bloco_inicio_lembrete:a0260000-0000-4000-8000-000000000001:%';/);
  assert.match(volta, /delete from supabase_migrations\.schema_migrations where version = '20261030000260';/);
});

test("0260: com o fim do bloco 1 a 2 dias, nenhuma regra automática dispara; o bloco 2 da prorrogação dispara", () => {
  const hoje = "2026-10-30";
  const fim1 = somaDias(hoje, 2);
  // Nada sozinho: saída só a 3 dias exatos, renovação a 15; o bloco 1 nunca é "renovado".
  for (let d = 0; d <= 2; d++) {
    const dia = somaDias(hoje, d);
    assert.equal(lembreteDeSaida(fim1, dia), false, dia);
    assert.equal(avisarRenovacao(fim1, dia), false, dia);
  }
  const bloco1 = { numero: 1, inicio: somaDias(hoje, -29), fim: fim1, meses: 1, valor: 3200, status: "ativo", aceiteProprietario: null, aceiteInquilino: null };
  assert.equal(blocoRenovado(bloco1), false);
  // A prova: o aditivo cria o bloco 2 a partir de D+3, aceito pelas duas partes, sem pagamento → lembrete em D, D+1 e D+2.
  const bloco2 = { numero: 2, inicio: somaDias(hoje, 3), fim: somaDias(hoje, 33), meses: 1, valor: 3200, status: "agendado", aceiteProprietario: "x", aceiteInquilino: "x" };
  for (let d = 0; d <= 2; d++) assert.equal(precisaLembreteDoBloco(bloco2, somaDias(hoje, d), 0), true, `D+${d}`);
  assert.equal(precisaLembreteDoBloco(bloco2, hoje, 1), false, "com pagamento registrado, não sai");
});
