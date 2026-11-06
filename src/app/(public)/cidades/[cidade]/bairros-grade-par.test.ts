/*
  Varredura 02/11 (Pista A), largura de tablet (768 px): na página da cidade, os bairros ficam em 2 colunas e, com
  número ímpar (3 em Uberlândia), sobrava um buraco ao lado do último. Grade par só em 2 colunas.
  Roda: npm test
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

const CLASSE = 'mt-4 grid gap-3 sm:grid-cols-2 sm:max-lg:[&>:last-child:nth-child(odd)]:col-span-full lg:grid-cols-6 lg:[&>*]:col-span-2 lg:[&>:last-child:nth-child(3n+1)]:col-span-6 lg:[&>:last-child:nth-child(3n+2)]:col-span-3 lg:[&>:nth-last-child(2):nth-child(3n+1)]:col-span-3';

test("bairros da cidade em grade par no tablet (2 colunas) e no computador (3 colunas)", () => {
  // Varredura 23 (1280 px): 13 bairros em 3 colunas deixavam o último sozinho. No computador a grade é de 6 colunas de
  // 2: cada bairro ocupa 2 (3 por linha); com 1 sobrando, o último ocupa a linha; com 2 sobrando, os dois dividem a linha.
  assert.ok(src.includes(`<ul className="${CLASSE}" data-testid="bairros-lista">`));
});

/** Reproduz a regra das classes: devolve quantos bairros ficam em cada linha do computador. */
function linhasNoComputador(n: number): number[] {
  const largura = (i: number): number => {
    const ultimo = i === n;
    if (ultimo && i % 3 === 1) return 6;
    if (ultimo && i % 3 === 2) return 3;
    if (i === n - 1 && i % 3 === 1) return 3;
    return 2;
  };
  const linhas: number[] = [];
  let usado = 0;
  let naLinha = 0;
  for (let i = 1; i <= n; i++) {
    const l = largura(i);
    if (usado + l > 6) { linhas.push(naLinha); usado = 0; naLinha = 0; }
    usado += l;
    naLinha++;
  }
  if (naLinha) linhas.push(naLinha);
  return linhas;
}

test("computador: nenhuma quantidade de bairros deixa a última linha com buraco", () => {
  for (let n = 3; n <= 20; n++) {
    const ls = linhasNoComputador(n);
    const ultima = ls[ls.length - 1];
    // linha cheia (3 cartões de 2), 2 cartões de 3 ou 1 cartão de 6: sempre 6 de 6 colunas
    const resto = n % 3;
    assert.equal(ultima, resto === 0 ? 3 : resto === 1 ? 1 : 2, `n=${n}`);
  }
  assert.deepEqual(linhasNoComputador(13), [3, 3, 3, 3, 1]);
  assert.deepEqual(linhasNoComputador(14), [3, 3, 3, 3, 2]);
});
