/*
  E699 (a)/(c) — massa de identidade PENDENTE: dona de teste COM CPF e SEM laudo. A migração só grava um CPF de teste
  (válido nos dígitos) em proprietario-qa; não cria laudo nem confirma identidade. Roda: node --test src/lib/qa/massa-identidade-pendente-e699.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadoIdentidadeDe } from "../identidade/estado.ts";
import { estadoIdentidadeParaTrava } from "../anuncio/travas-publicacao.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const sem = (s: string) => s.replace(/^\s*--.*$/gm, "");

function cpfValido(c: string): boolean {
  if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

test("o CPF de teste da 0330 passa nos dígitos verificadores e é diferente do do Paulo (0297)", () => {
  assert.ok(cpfValido("00000000272"));
  assert.ok(cpfValido("00000000191"));
  assert.notEqual("00000000272", "00000000191");
});

test("conta de teste com CPF e sem laudo cai no ramo PENDENTE da trava (o que o E699 (a)/(c) precisa)", () => {
  const identidade = estadoIdentidadeDe(null, true, new Date("2026-11-08T12:00:00Z"));
  assert.equal(identidade.estado, "simulavel");
  assert.equal(estadoIdentidadeParaTrava({ identidade, temCpf: true }), "pendente");
  // sem CPF seria o outro ramo (é o estado das donas de teste de hoje):
  assert.equal(estadoIdentidadeParaTrava({ identidade, temCpf: false }), "sem_cpf");
});

for (const arquivo of ["supabase/migrations/0330_qa_identidade_pendente_e699.sql", "supabase/producao/aplicar-0330.sql"]) {
  test(`${arquivo}: só CPF de teste, só conta is_teste sem documento, sem criar laudo`, () => {
    const sql = sem(ler(arquivo));
    assert.match(sql, /lower\(email\) = 'proprietario-qa@mail-teste\.com\.br' and is_teste/);
    assert.match(sql, /update public\.profiles set cpf = c_cpf where id = v_dona and cpf is null and cnpj is null/);
    assert.match(sql, /o CPF de teste já está em outra conta; nada a fazer/);
    assert.doesNotMatch(sql, /tenant_verifications|insert into public|delete from public|AUTOMACOES_ATIVO|chaves_plataforma|properties/i);
  });
}

test("aplicar-0330: transação, registra 20261107000330 e o rollback só desfaz o CPF de teste", () => {
  const ap = ler("supabase/producao/aplicar-0330.sql");
  assert.match(ap, /\nbegin;[\s\S]*commit;\s*$/);
  assert.match(ap, /select '20261107000330', '0330_qa_identidade_pendente_e699'[\s\S]*where not exists/);
  const rb = ler("supabase/producao/rollback/0330_rollback.sql");
  assert.match(rb, /set cpf = null[\s\S]*cpf = '00000000272'/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261107000330'/);
});
