/*
  E1054 — trava: no passo de Preço do anúncio, o cartão "Caução (depósito devolvível)" mostra também o VALOR calculado
  da caução — o mesmo valor e a mesma fonte da revisão (E1050). A revisão (`caucaoDaPrevia`) e o passo de Preço chamam a
  mesma função, com o mesmo rótulo.
  E1061 (lei do produto, Daniel, 20/11/2026): a função deixa de ser "50% do mensal" (`caucaoDoMensal`) e passa a ser a
  da página do imóvel (`caucaoDoAnuncio`, que lê `caucaoDoPrimeiroBloco` com a estadia mínima do anúncio). As asserções
  abaixo mudam por essa decisão; a propriedade cobrada é a mesma: Preço = revisão, mesma função, mesmo rótulo.
  Roda: node --test src/lib/anuncio/e1054-caucao-no-passo-preco.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { caucaoDaPrevia, caucaoDoAnuncio } from "./passo10-colunas.ts";
import type { Property } from "../types.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const preco = ler("app/(dashboard)/dashboard/imoveis/novo/etapa-preco.tsx");
const passo10 = ler("lib/anuncio/passo10-colunas.ts");

test("E1054 — para o mesmo anúncio, o valor do passo de Preço é igual ao da revisão", () => {
  for (const digitado of ["3000", "2450.50", "1", "0", "", "abc"]) for (const minimo of ["30", "60", "90", ""]) {
    // O passo de Preço lê os campos como `Number(p.monthlyPrice) || 0` e `Number(p.minPeriod) || 30`; a prévia da
    // revisão monta `monthlyPrice` e `minPeriodDays` igual.
    const noPasso = caucaoDoAnuncio(Number(digitado) || 0, Number(minimo) || 30);
    const naRevisao = caucaoDaPrevia({ monthlyPrice: Number(digitado) || 0, minPeriodDays: Number(minimo) || 30 } as Property);
    assert.deepEqual(noPasso, naRevisao, `mensal "${digitado}", mínimo "${minimo}"`);
  }
  assert.deepEqual(caucaoDoAnuncio(3000, 30), { valor: 1500, rotulo: "Caução do 1º bloco (1 mês)" });
  assert.deepEqual(caucaoDoAnuncio(3000, 90), { valor: 4500, rotulo: "Caução do 1º bloco (3 meses)" });
  assert.equal(caucaoDoAnuncio(0, 30), null);
});

test("E1054 — a revisão e o passo de Preço usam a MESMA função e o MESMO rótulo", () => {
  assert.match(passo10, /export function caucaoDaPrevia\(property: Property\): CaucaoDoAnuncio \| null \{\s*return caucaoDoAnuncio\(/);
  assert.match(passo10, /caucaoDoPrimeiroBloco\(/);
  assert.match(preco, /import \{[^}]*\bcaucaoDoAnuncio\b[^}]*\} from "@\/lib\/anuncio\/passo10-colunas"/);
  assert.match(preco, /caucaoDoAnuncio\(aluguel, Number\(p\.minPeriod\) \|\| 30\)/);
  assert.match(preco, /data-testid="preco-caucao-valor"/);
  assert.match(preco, /\{caucao\.rotulo\}/);
});
