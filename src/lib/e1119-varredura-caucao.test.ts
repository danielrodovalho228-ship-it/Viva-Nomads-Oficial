/*
  E1119 (ORDEM-DUET-512): a t118 (varredura de texto) proíbe "aluguel" e a frase decidida da caução usa "aluguel"
  (E1076, ORDEM-DUET-366: "a regra da casa cede aqui à frase provada"). Quem se adapta é a varredura: uma exceção
  NOMEADA e ESTREITA, só para a frase da regra da caução, LIDA DA FONTE (REGRA_CAUCAO_BASE, src/lib/caucao-regra.ts)
  — nunca uma cópia à mão. "aluguel" continua proibido em qualquer outro texto, e a exceção não vale para outro termo.
  Roda: node --test src/lib/e1119-varredura-caucao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { achadosNoTexto, achadosNasMetas, semFraseDaCaucao } from "./varredura-texto.ts";
import { REGRA_CAUCAO, REGRA_CAUCAO_BASE, REGRA_CAUCAO_FRASE } from "./caucao-regra.ts";
import { NOTA_CAUCAO } from "./reserva-imovel.ts";
import { ROTULO_CAUCAO_NA_ENTRADA, TITULO_CAUCAO_GARANTIA } from "./fechamento-caucao-texto.ts";
import { fonteSemComentarios } from "./fonte-sem-comentarios.ts";

const aluguel = (achados: string[]) => achados.filter((a) => a.includes('"aluguel"'));

test("E1119: a frase da caução, como as telas a mostram, não é achado de 'aluguel'", () => {
  for (const t of [REGRA_CAUCAO_BASE, REGRA_CAUCAO, REGRA_CAUCAO_FRASE, NOTA_CAUCAO, ROTULO_CAUCAO_NA_ENTRADA, TITULO_CAUCAO_GARANTIA, `Caução: ${REGRA_CAUCAO}.`]) {
    assert.deepEqual(aluguel(achadosNoTexto(`Garantia. ${t} Depositada antes da entrada.`)), [], t);
  }
  assert.deepEqual(aluguel(achadosNasMetas([`Caução de ${REGRA_CAUCAO}.`])), []);
});

test("E1119: 'aluguel' em qualquer outro texto continua reprovado — também ao lado da frase da caução", () => {
  assert.equal(aluguel(achadosNoTexto("O aluguel mensal é R$ 2.000.")).length, 1);
  assert.equal(aluguel(achadosNoTexto(`${NOTA_CAUCAO} Seu aluguel sobe todo ano.`)).length, 1);
  assert.equal(aluguel(achadosNoTexto("Aluguéis por temporada")).length, 1);
  // Um pedaço da frase não é a frase: "do aluguel" sozinho continua reprovado.
  assert.equal(aluguel(achadosNoTexto("50% do aluguel do mês")).length, 1);
  assert.equal(aluguel(achadosNoTexto("metade do aluguel da estadia")).length, 1);
});

test("E1119: a exceção é só para 'aluguel' — os outros termos proibidos ao lado da frase continuam reprovados", () => {
  const achados = achadosNoTexto(`${REGRA_CAUCAO}, devolvida após a vistoria de saída.`);
  assert.ok(achados.some((a) => a.includes('"vistoria"')), achados.join(" | "));
  assert.deepEqual(aluguel(achados), []);
});

test("E1119: a exceção lê a frase da fonte (segue-a se mudar) e não há cópia à mão na varredura", () => {
  const fonte = readFileSync("src/lib/varredura-texto.ts", "utf8");
  assert.match(fonte, /import \{ REGRA_CAUCAO_BASE \} from "\.\/caucao-regra\.ts";/);
  assert.doesNotMatch(fonteSemComentarios(fonte), /aluguel da estadia/i, "cópia à mão da frase na varredura");
  // semFraseDaCaucao tira exatamente a frase-fonte, e nada mais.
  assert.equal(semFraseDaCaucao(`a ${REGRA_CAUCAO_BASE} b`), "a   b");
  assert.equal(semFraseDaCaucao("o aluguel"), "o aluguel");
  // A aplicação é só ao termo "aluguel" (a exceção não é passada ao texto inteiro).
  assert.match(fonte, /const alvo = nome === "aluguel" \? semFraseDaCaucao\(texto\) : texto;/);
});
