/*
  E744, passo 6 (15/11/2026) — t886 (cabeçalho das telas da Conta para o parceiro; nunca teve registro verde).
  O teste grava `profiles.papel_ativo = "parceiro"` direto no banco e espera o cabeçalho do parceiro. Decisão registrada:
  E668 — "parceiro" gravado só vale se foi ESCOLHIDO, com o carimbo `profiles.papel_ativo_escolhido_em`
  (`src/lib/papel/papel-ativo.ts`, `papelGravadoEfetivo`; `docs/e668-papel-escolhido.md`). Sem o carimbo a conta abre no modo
  dela (proprietário), e o cabeçalho do parceiro não existe. A semente passa a gravar o carimbo, como a escolha pelo selo
  ou pela Conta grava (`src/lib/data/papel-actions.ts`). Nenhuma asserção mudou.

  Roda: node --test tests/laboratorio/e744-t886-papel-escolhido.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { papelGravadoEfetivo } from "../../src/lib/papel/papel-ativo.ts";

const t886 = readFileSync("tests/e2e/specs/t886-e464-cabecalho-conta.spec.ts", "utf8");

test("E744 t886: a regra do produto — 'parceiro' gravado só vale com o carimbo da escolha (E668)", () => {
  assert.equal(papelGravadoEfetivo("parceiro", null), null);
  assert.equal(papelGravadoEfetivo("parceiro", ""), null);
  assert.equal(papelGravadoEfetivo("parceiro", "2026-11-15T12:00:00.000Z"), "parceiro");
});

test("E744 t886: a semente grava o papel de parceiro COM o carimbo da escolha; as asserções do cabeçalho ficam", () => {
  const semente = t886.split("\n").find((l) => l.includes('papel_ativo: "parceiro"')) ?? "";
  assert.match(semente, /papel_ativo_escolhido_em: new Date\(\)\.toISOString\(\)/, "o carimbo vai junto com o papel");
  assert.match(t886, /getByTestId\("topo-parceiro"\)\.getByTestId\("sino-parceiro"\)/, "a cobrança do sino no cabeçalho do parceiro continua");
});
