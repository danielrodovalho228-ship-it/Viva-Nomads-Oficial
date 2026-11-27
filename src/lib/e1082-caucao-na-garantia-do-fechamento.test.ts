/*
  E1082 (ORDEM-DUET-392) — o passo Garantia do Fechamento diz a regra decidida da caução, da fonte única.
  A prova ao vivo de 21/11 fechou a frase na página do imóvel ("50% do aluguel da estadia", E1076) e achou o resto:
  o Fechamento ainda dizia a regra antiga — "Caução por bloco (50% do 1º bloco)", "X% do valor do período, no máximo
  3 aluguéis" e, no quadro do contrato, "Caução (X% do período, antes da entrada)".
  A regra em palavras vem de src/lib/caucao-regra.ts (lei do E777: um texto, uma fonte). Os valores não mudam.
  Roda: node --test src/lib/e1082-caucao-na-garantia-do-fechamento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REGRA_CAUCAO, REGRA_CAUCAO_BASE } from "./caucao-regra.ts";
import { ROTULO_CAUCAO_NA_ENTRADA, TEXTO_BLOCOS_GARANTIA, TITULO_CAUCAO_GARANTIA, quantoOMoradorPaga } from "./fechamento-caucao-texto.ts";
import { fonteSemComentarios } from "./fonte-sem-comentarios.ts";

const tela = readFileSync(new URL("../app/(dashboard)/dashboard/fechamento/closing-flow.tsx", import.meta.url), "utf8");
/** Só o texto que a pessoa lê: o que está entre aspas, crases ou solto no JSX — sem os comentários do código. */
const semComentarios = fonteSemComentarios(tela);

test("os textos da Garantia saem da fonte única da regra", () => {
  assert.equal(TITULO_CAUCAO_GARANTIA, "Caução (50% do aluguel da estadia)");
  assert.equal(TITULO_CAUCAO_GARANTIA, `Caução (${REGRA_CAUCAO_BASE})`);
  assert.equal(
    TEXTO_BLOCOS_GARANTIA(2),
    "A caução é de 50% do aluguel da estadia, no máximo 3 vezes o valor mensal. O período é contratado em blocos de 2 meses e cada bloco leva a sua parte da caução (a tabela mostra quanto): cabe no cartão e vai para a poupança da caução. A plataforma nunca recebe.",
  );
  assert.ok(TEXTO_BLOCOS_GARANTIA(3).includes(REGRA_CAUCAO));
});

test("'Sua proteção': quanto o morador paga, com a regra e o teto em reais", () => {
  // O formatador de reais da casa separa "R$" do número com espaço duro; a comparação é pelo texto que se lê.
  assert.equal(quantoOMoradorPaga({ caucao: 1292, valorMensal: 2500 }).replace(/\u00a0/g, " "), "R$ 1.292 depositados na entrada (50% do aluguel da estadia, no máximo 3 vezes o valor mensal, que são R$ 7.500)");
});

test("quadro do contrato: a linha da caução diz a regra decidida, não 'X% do período'", () => {
  assert.equal(ROTULO_CAUCAO_NA_ENTRADA, "Caução (50% do aluguel da estadia, antes da entrada)");
  // O resto da frase ("devolvida no fim…") continua escrito na tela, onde a trava do Prompt 24 já o procura.
  assert.match(tela, /\{ROTULO_CAUCAO_NA_ENTRADA\} — devolvida no fim, conforme a conferência de saída/);
});

test("a tela usa esses textos e não escreve mais a regra antiga à mão", () => {
  assert.match(tela, /\{TITULO_CAUCAO_GARANTIA\}/);
  assert.match(tela, /\{TEXTO_BLOCOS_GARANTIA\(TAMANHO_BLOCO\)\}/);
  assert.match(tela, /quantoOMoradorPaga\(\{ caucao, valorMensal: aluguel \}\)/);
  assert.doesNotMatch(semComentarios, /Caução por bloco/);
  // "Parcelas (caução do 1º bloco)" é rótulo de parcelamento e fica; o que sai é a regra "(X% do 1º bloco)".
  assert.doesNotMatch(semComentarios, /\} do 1º bloco\)|% do 1º bloco\)/);
  assert.doesNotMatch(semComentarios, /do valor do período, no máximo 3 aluguéis/);
  assert.doesNotMatch(semComentarios, /do período, no máximo 3 aluguéis/);
  assert.doesNotMatch(semComentarios, /do período, antes da entrada/);
});
