/*
  E688 — o Plano de manutenção volta a "em_breve" (banco e catálogo de reserva), para o morador não conseguir escolher o
  serviço sem a saída AquiResolve. Roda: node --test src/lib/qa/e688-plano-manutencao-em-breve.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const semComentario = (s: string) => s.replace(/^\s*--.*$/gm, "");

for (const f of ["supabase/migrations/0333_plano_manutencao_em_breve_e688.sql", "supabase/producao/aplicar-0333.sql"]) {
  test(`${f}: só o plano_manutencao, só de ativo para em_breve, sem apagar nada`, () => {
    const sql = semComentario(ler(f));
    assert.match(sql, /update public\.servicos_adicionais\s+set status = 'em_breve'\s+where id = 'plano_manutencao' and status = 'ativo';/);
    assert.equal((sql.match(/\bupdate\s+public\./gi) ?? []).length, 1);
    assert.doesNotMatch(sql, /\b(delete|drop|truncate)\b[^;]*servicos_adicionais/i);
    assert.doesNotMatch(sql, /AUTOMACOES_ATIVO|VISTORIA_ATIVA|CAUCAO_PRAZOS_ATIVA/);
  });
}

test("aplicar-0333 registra a versão 20261107000333; o rollback devolve ativo", () => {
  assert.match(ler("supabase/producao/aplicar-0333.sql"), /'20261107000333', '0333_plano_manutencao_em_breve_e688'/);
  assert.match(ler("supabase/producao/rollback/0333_rollback.sql"), /set status = 'ativo' where id = 'plano_manutencao'/);
});

test("o catálogo de reserva do código espelha o banco: plano_manutencao em_breve", () => {
  const g = ler("src/lib/guarantees.ts");
  const bloco = g.slice(g.indexOf('id: "plano_manutencao"'));
  assert.match(bloco.slice(0, 400), /status: "em_breve"/);
});
