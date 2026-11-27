/* Roda: node --test src/lib/proprietario/grade-imoveis.test.ts
  Varredura 20 (05/11, 1280): em /proprietario/[id], "Imóveis de …" com 5 imóveis saía em 4 colunas — o quinto ficava
  sozinho na 2ª linha, ao lado do vazio (buraco na última linha, fora da regra da grade par da casa). As colunas do
  computador agora seguem a quantidade: sem buraco quando existe divisão exata (4, 3 ou 5 colunas); até 4 imóveis, uma
  linha de 4 (cartão no tamanho de sempre).
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { colunasGradeImoveis, classeGradeImoveis } from "./grade-imoveis.ts";

test("até 4 imóveis: uma linha de 4 (o cartão não incha)", () => {
  for (const n of [1, 2, 3, 4]) assert.equal(colunasGradeImoveis(n), 4);
});

test("sem buraco na última linha quando há divisão exata", () => {
  assert.equal(colunasGradeImoveis(5), 5); // o caso do relato: 4 + 1 → uma linha de 5
  assert.equal(colunasGradeImoveis(6), 3);
  assert.equal(colunasGradeImoveis(8), 4);
  assert.equal(colunasGradeImoveis(9), 3);
  assert.equal(colunasGradeImoveis(10), 5);
  assert.equal(colunasGradeImoveis(12), 4);
});

test("quantidade sem divisão exata (7, 11…): segue em 4 colunas", () => {
  assert.equal(colunasGradeImoveis(7), 4);
  assert.equal(colunasGradeImoveis(11), 4);
});

test("classes literais (o Tailwind precisa vê-las no código) e a página usa a função", () => {
  assert.match(classeGradeImoveis(5), /xl:grid-cols-5/);
  assert.match(classeGradeImoveis(6), /xl:grid-cols-3/);
  assert.match(classeGradeImoveis(3), /xl:grid-cols-4/);
  // A página real e o perfil de exemplo (demonstração) usam a mesma grade.
  for (const f of ["page.tsx", "perfil-exemplo.tsx"]) {
    const pagina = readFileSync(`src/app/(public)/proprietario/[id]/${f}`, "utf8");
    assert.match(pagina, /classeGradeImoveis\(imoveis\.length\)/, f);
    assert.doesNotMatch(pagina, /sm:grid-cols-2 xl:grid-cols-4/, f);
  }
});
