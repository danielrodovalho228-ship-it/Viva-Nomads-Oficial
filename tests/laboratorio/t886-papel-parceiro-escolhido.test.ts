import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { papelGravadoEfetivo } from "../../src/lib/papel/papel-ativo.ts";

// Rodada completa do lab 10/11 (5eb1fad9): t886 não achou o sino do parceiro em /dashboard/conta/perfil. A spec grava só
// profiles.papel_ativo = "parceiro"; desde o E668 (migração 0318) o papel "parceiro" só vale se foi ESCOLHIDO
// (profiles.papel_ativo_escolhido_em). Sem o carimbo a conta abre como proprietário e o cabeçalho é o do dono.
test("t886: a conta da spec abre como parceiro porque grava o carimbo da escolha (E668)", () => {
  assert.equal(papelGravadoEfetivo("parceiro", null), null);
  assert.equal(papelGravadoEfetivo("parceiro", "2026-11-11T00:00:00.000Z"), "parceiro");
  const spec = readFileSync("tests/e2e/specs/t886-e464-cabecalho-conta.spec.ts", "utf8");
  assert.match(spec, /papel_ativo: "parceiro", papel_ativo_escolhido_em: new Date\(\)\.toISOString\(\)/);
});
