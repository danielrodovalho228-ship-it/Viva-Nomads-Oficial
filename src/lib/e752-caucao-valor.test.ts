/*
  E752 — a Caução mostra o VALOR do 1º bloco no anúncio (pela regra do contrato) e o texto público segue o desenho
  aprovado: 50% do bloco, teto de 3 vezes o valor mensal, direto ao proprietário, a Viva não segura.
  Roda: node --test src/lib/e752-caucao-valor.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { caucaoDoPrimeiroBloco, linhasDeTaxas, NOTA_CAUCAO } from "./reserva-imovel.ts";
import { CAUCAO_FRASE } from "./faixas.ts";
import { formatBRL } from "./utils.ts";

test("valor do 1º bloco = 50% do bloco da estadia mínima (1 a 3 meses), nunca acima de 3 aluguéis", () => {
  assert.deepEqual(caucaoDoPrimeiroBloco(3000, 30), { valor: 1500, meses: 1 });
  assert.deepEqual(caucaoDoPrimeiroBloco(3000, 60), { valor: 3000, meses: 2 });
  assert.deepEqual(caucaoDoPrimeiroBloco(3000, 90), { valor: 4500, meses: 3 });
  assert.deepEqual(caucaoDoPrimeiroBloco(3000, 180), { valor: 4500, meses: 3 }, "bloco passa de 90 dias: fica no máximo de 3 meses");
  assert.deepEqual(caucaoDoPrimeiroBloco(3000), { valor: 3000, meses: 2 }, "sem estadia mínima: bloco padrão de 2 meses");
  assert.equal(caucaoDoPrimeiroBloco(0, 30), null);
});

test("a linha Caução do cartão traz valor e a regra, sem 'o valor fica no contrato'", () => {
  const l = linhasDeTaxas({ monthlyPrice: 3800, minPeriodDays: 30 }).find((x) => x.chave === "caucao")!;
  assert.equal(l.valor, formatBRL(1900));
  assert.match(l.rotulo, /1º bloco \(1 mês\)/);
  assert.equal(l.nota, NOTA_CAUCAO);
  assert.doesNotMatch(l.nota!, /valor fica no contrato/);
});

test("o texto público não promete poupança: diz direto ao proprietário, teto de 3 vezes o valor mensal e que a Viva não segura", () => {
  // O texto PÚBLICO (site, Ajuda, chat) segue sem regra de bloco/percentual (guarda regras-publicas); a regra completa fica no cartão do anúncio.
  assert.match(CAUCAO_FRASE, /até 3 vezes o valor mensal/);
  assert.match(CAUCAO_FRASE, /paga direto ao proprietário/);
  assert.match(CAUCAO_FRASE, /a Viva não recebe nem segura/);
  assert.doesNotMatch(CAUCAO_FRASE, /poupança/);
  const pagina = readFileSync("src/app/(public)/como-funciona/page.tsx", "utf8");
  assert.match(pagina, /CAUCAO_FRASE/);
  assert.doesNotMatch(pagina, /Depositada antes da entrada/);
});
