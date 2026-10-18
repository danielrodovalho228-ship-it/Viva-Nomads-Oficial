import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAF_JANELA_CONSULTA_S, CAF_VALIDADE_MESES, TEXTO_VALIDADE_CAF, validadeDoLaudo } from "./validade.ts";

test("p22 item 5 — identidade vale 12 meses (decisão do Daniel, 18/10) e a cota é 1 consulta por 12 meses", () => {
  assert.equal(CAF_VALIDADE_MESES, 12);
  assert.equal(validadeDoLaudo(new Date("2026-10-18T12:00:00Z")).toISOString(), "2027-10-18T12:00:00.000Z");
  assert.equal(CAF_JANELA_CONSULTA_S, 365 * 86_400);
  assert.match(TEXTO_VALIDADE_CAF, /12 meses/);
  assert.match(TEXTO_VALIDADE_CAF, /nome ou o CPF/);
  const rota = readFileSync("src/app/api/caf/verify/route.ts", "utf8");
  assert.doesNotMatch(rota, /90 \* DIA/, "nada de 90 dias na verificação");
  assert.match(rota, /consumirLimite\(`caf:user:\$\{user\.id\}`, 1, CAF_JANELA_CONSULTA_S\)/);
  assert.equal((rota.match(/validadeDoLaudo\(new Date\(\)\)/g) ?? []).length, 2, "laudo real e simulado com a mesma validade");
});

test("p22 item 5 — trocou nome ou CPF: o banco tira a validade do laudo e libera a cota (0164)", () => {
  const sql = readFileSync("supabase/producao/aplicar-0164.sql", "utf8");
  assert.match(sql, /after update of full_name, cpf on public\.profiles/);
  assert.match(sql, /new\.full_name is distinct from old\.full_name or new\.cpf is distinct from old\.cpf/);
  assert.match(sql, /update public\.tenant_verifications\s+set valid_until = now\(\)/);
  assert.match(sql, /delete from public\.limites_uso where chave = 'caf:user:' \|\| new\.id::text/);
});
