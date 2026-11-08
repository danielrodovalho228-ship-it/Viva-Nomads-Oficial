/*
  E689 (correção, migração 0328) — as datas dos BLOCOS das estadias-semente. O app lê o ÚLTIMO DIA do último bloco
  (contrato_blocos.fim, inclusivo) como a saída; a 0327 acertou o período (daterange, exclusivo) mas deixou o bloco um dia
  curto: a semana da saída caía em ALVO-1 e o meio da estadia (bloco de 59 dias) nem existia. Este teste lê as datas do
  SQL da 0328 e roda a regra REAL da jornada sobre elas.
  Roda: node --test src/lib/qa/massa-estadia-semente-datas-0328.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { momentosDeHoje } from "../estadia/jornada-mensagens.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const MIG = "supabase/migrations/0328_qa_estadia_semente_datas_e689.sql";
const APLICAR = "supabase/producao/aplicar-0328.sql";
const ALVO = "2026-11-10";
const soma = (n: number) => new Date(Date.parse(`${ALVO}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Lê `inicio = v_alvo ± a, fim = v_alvo ± b` do bloco indicado e devolve os deslocamentos. */
function bloco(sql: string, id: string): { inicio: number; fim: number } {
  const m = new RegExp(`set inicio = v_alvo(?: ([-+] \\d+))?, fim = v_alvo(?: ([-+] \\d+))? where id = ${id}`).exec(sql);
  assert.ok(m, `bloco ${id} não encontrado no SQL`);
  const n = (s?: string) => (s ? Number(s.replace(/\s/g, "")) : 0);
  return { inicio: n(m![1]), fim: n(m![2]) };
}

for (const arquivo of [MIG, APLICAR]) {
  test(`${arquivo}: a regra real da jornada dispara UM momento por estadia no dia ALVO, lendo o bloco como o app lê`, () => {
    const sql = ler(arquivo);
    const c = bloco(sql, "c_bloco_c");
    const m = bloco(sql, "c_bloco_m");
    const s = bloco(sql, "c_bloco_s");
    assert.deepEqual(momentosDeHoje({ entrada: soma(c.inicio), fim: soma(c.fim), hoje: ALVO }), ["jornada_chegada"]);
    assert.deepEqual(momentosDeHoje({ entrada: soma(m.inicio), fim: soma(m.fim), hoje: ALVO }), ["jornada_meio_estadia"]);
    assert.deepEqual(momentosDeHoje({ entrada: soma(s.inicio), fim: soma(s.fim), hoje: ALVO }), ["jornada_semana_saida"]);
    // A saída (último dia do bloco) é ALVO+7 e o meio tem 60 dias de bloco.
    assert.equal(s.fim, 7);
    assert.equal(m.fim - m.inicio, 60);
  });
}

test("O13 (QA): cada UPDATE de bloco e de pagamento leva guarda por linha (contrato do próprio bloco, ativo)", () => {
  for (const arquivo of [MIG, APLICAR]) {
    const sql = ler(arquivo);
    for (const suf of ["c", "m", "s"]) {
      assert.match(sql, new RegExp(`update public\\.contrato_blocos set [^;]*where id = c_bloco_${suf} and contrato_id = c_contrato_${suf}\\s+and exists \\(select 1 from public\\.contratos k where k\\.id = c_contrato_${suf} and k\\.status = 'ativo'\\);`));
      assert.match(sql, new RegExp(`update public\\.pagamentos_bloco set [^;]*where bloco_id = c_bloco_${suf} and contrato_id = c_contrato_${suf} and observacao`));
    }
  }
});

test("0328 só mexe nas linhas de ids fixos a0327…, só com contrato ativo e dono de conta de teste", () => {
  const sql = ler(MIG);
  assert.match(sql, /join public\.profiles pr on pr\.id = p\.owner_id and pr\.is_teste/);
  assert.match(sql, /c\.status = 'ativo'/);
  for (const id of ["a0327a00", "a0327b00", "a0327c00"]) assert.match(sql, new RegExp(`'${id}-0000-4000-8000-0000000000(11|21)'`));
  assert.doesNotMatch(sql, /(?:update|delete)\s+public\.(?:properties|profiles|leads|parceiro)/i);
  assert.doesNotMatch(sql, /AUTOMACOES_ATIVO|chaves_plataforma/);
});

test("aplicar-0328: transação, idempotente, registra 20261107000328 e tem rollback", () => {
  const ap = ler(APLICAR);
  assert.match(ap, /^[\s\S]*\nbegin;[\s\S]*commit;\s*$/);
  assert.match(ap, /insert into supabase_migrations\.schema_migrations \(version, name\)\s*select '20261107000328', '0328_qa_estadia_semente_datas_e689'/);
  assert.match(ap, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261107000328'\)/);
  assert.match(ler("supabase/producao/rollback/0328_rollback.sql"), /delete from supabase_migrations\.schema_migrations where version = '20261107000328'/);
});
