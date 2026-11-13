/*
  E813 — a caução diz a BASE: 50% do VALOR MENSAL (só o aluguel, sem condomínio nem contas) por mês de cada bloco, no
  máximo 3 vezes o valor mensal no contrato. A mesma frase única nas superfícies que apresentam a regra.
  Roda: node --test src/lib/e813-caucao-base.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAUCAO_BASE, CAUCAO_CURTA, CAUCAO_REGRA } from "./faixas.ts";
import { NOTA_CAUCAO, caucaoDoPrimeiroBloco } from "./reserva-imovel.ts";
import { SAMPLE_PROPERTIES } from "./properties.ts";
import { REGRAS_CONTRATO } from "../config/planos.ts";
import { achadosProibidos } from "./frases-proibidas.ts";

const ler = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("a frase diz a base (valor mensal, só o aluguel) com os números da regra do contrato", () => {
  assert.equal(CAUCAO_BASE, "50% do valor mensal (só o aluguel, sem condomínio nem contas) por mês de cada bloco, no máximo 3 vezes o valor mensal no contrato");
  assert.equal(REGRAS_CONTRATO.caucaoFracaoBloco, 0.5);
  assert.match(NOTA_CAUCAO, /^50% do valor mensal \(só o aluguel, sem condomínio nem contas\) por mês de cada bloco/);
  assert.doesNotMatch(NOTA_CAUCAO, /50% do valor de cada bloco/);
  for (const t of [CAUCAO_BASE, CAUCAO_REGRA, CAUCAO_CURTA, NOTA_CAUCAO]) assert.deepEqual(achadosProibidos(t), [], t);
});

test("os números dos exemplos batem com a frase (ube-001, 002, 003)", () => {
  const p = (id: string) => SAMPLE_PROPERTIES.find((x) => x.id === id)!;
  for (const [id, valor, meses] of [["ube-001", 1600, 1], ["ube-002", 1200, 1], ["ube-003", 4100, 2]] as const) {
    const c = caucaoDoPrimeiroBloco(p(id).monthlyPrice, p(id).minPeriodDays)!;
    assert.deepEqual(c, { valor, meses }, id);
    assert.equal(c.valor, 0.5 * p(id).monthlyPrice * meses, `${id}: 50% do valor mensal × meses do bloco`);
  }
});

test("as superfícies que apresentam a regra usam a frase única", () => {
  assert.match(ler("app/(public)/page.tsx"), /<TrustItem icon=\{FileCheck\} text=\{CAUCAO_CURTA\} \/>/);
  assert.doesNotMatch(ler("app/(public)/page.tsx"), /text="Caução documentada"/);
  assert.match(ler("app/(public)/como-funciona/page.tsx"), /\{CAUCAO_FRASE\} \{CAUCAO_REGRA\}/);
  assert.match(ler("app/(public)/para-proprietarios/page.tsx"), /\$\{CAUCAO_FRASE\} \$\{CAUCAO_REGRA\}/);
  assert.match(ler("lib/seo/llms.ts"), /- Caução: \$\{CAUCAO_BASE\}/);
  assert.match(ler("lib/reserva-imovel.ts"), /export const NOTA_CAUCAO = `\$\{CAUCAO_BASE\[0\]\.toUpperCase\(\)\}/);
});
