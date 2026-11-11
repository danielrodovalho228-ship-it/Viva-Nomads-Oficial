import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nascimentoAoCarregar } from "../../src/lib/conta/nascimento.ts";

/*
  Lab 10/11 (5eb1fad9) e registro L-54: t373 digitava "31/02/1991" e o alerta "Data de nascimento inválida." não vinha;
  noutra rodada, "Dados salvos." com profiles.data_nascimento ainda null. Causa: a leitura da data gravada
  (getNascimento) chegava DEPOIS da digitação e trocava o campo por "" — o salvar mandava vazio (válido, opcional).
  Correção: a data que chega do servidor só preenche o campo se a pessoa ainda não digitou nada; e a spec só digita
  depois de a tela terminar de carregar (botão Salvar habilitado).
*/
test("t373: a data gravada que chega depois não apaga o que a pessoa já digitou", () => {
  assert.equal(nascimentoAoCarregar("31/02/1991", ""), "31/02/1991");
  assert.equal(nascimentoAoCarregar("14/03/1991", "01/01/1980"), "14/03/1991");
  assert.equal(nascimentoAoCarregar("", "01/01/1980"), "01/01/1980");
  assert.equal(nascimentoAoCarregar("", ""), "");
});

test("t373: a tela usa a regra ao carregar, e a spec espera o Salvar habilitado antes de digitar", () => {
  const tela = readFileSync("src/components/account/conta-secoes.tsx", "utf8");
  assert.match(tela, /setNascimento\(\(atual\) => nascimentoAoCarregar\(atual, n\)\)/);
  const spec = readFileSync("tests/e2e/specs/t373-conta-a4-dados.spec.ts", "utf8");
  const teste2 = spec.slice(spec.indexOf('test("2. data de nascimento'));
  assert.ok(teste2.indexOf('toBeEnabled') > -1 && teste2.indexOf('toBeEnabled') < teste2.indexOf('campo.fill("31021991")'));
});
