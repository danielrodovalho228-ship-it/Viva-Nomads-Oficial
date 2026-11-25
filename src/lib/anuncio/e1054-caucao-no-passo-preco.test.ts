/*
  E1054 — trava: no passo de Preço do anúncio, o cartão "Caução (depósito devolvível)" mostra também o VALOR calculado
  da caução — o mesmo valor e a mesma fonte da revisão (E1050). Fonte única: `caucaoDoMensal`; a revisão
  (`caucaoDaPrevia`) e o passo de Preço chamam essa mesma função, com o mesmo rótulo `ROTULO_CAUCAO_PREVIA`.
  Roda: node --test src/lib/anuncio/e1054-caucao-no-passo-preco.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { caucaoDaPrevia, caucaoDoMensal } from "./passo10-colunas.ts";
import type { Property } from "../types.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const preco = ler("app/(dashboard)/dashboard/imoveis/novo/etapa-preco.tsx");
const passo10 = ler("lib/anuncio/passo10-colunas.ts");

test("E1054 — para o mesmo anúncio, o valor do passo de Preço é igual ao da revisão", () => {
  for (const digitado of ["3000", "2450.50", "1", "0", "", "abc"]) {
    // O passo de Preço lê o campo como `Number(p.monthlyPrice) || 0`; a prévia da revisão monta `monthlyPrice` igual.
    const noPasso = caucaoDoMensal(Number(digitado) || 0);
    const naRevisao = caucaoDaPrevia({ monthlyPrice: Number(digitado) || 0 } as Property);
    assert.equal(noPasso, naRevisao, `mensal "${digitado}"`);
  }
  assert.equal(caucaoDoMensal(3000), 1500);
  assert.equal(caucaoDoMensal(0), null);
});

test("E1054 — a revisão e o passo de Preço usam a MESMA função e o MESMO rótulo", () => {
  assert.match(passo10, /export function caucaoDaPrevia\(property: Property\): number \| null \{\s*return caucaoDoMensal\(/);
  assert.match(preco, /import \{[^}]*\bROTULO_CAUCAO_PREVIA\b[^}]*\bcaucaoDoMensal\b[^}]*\} from "@\/lib\/anuncio\/passo10-colunas"/);
  assert.match(preco, /caucaoDoMensal\(aluguel\)/);
  assert.match(preco, /data-testid="preco-caucao-valor"/);
  assert.match(preco, /\{ROTULO_CAUCAO_PREVIA\}/);
});
