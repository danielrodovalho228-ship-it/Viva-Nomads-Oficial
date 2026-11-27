/*
  E1067 — fusão do #4078, 1.º passo (ORDENS-DUET 1149, 1154 e 1193): a frase da base de cálculo do Fechamento
  ("Base de cálculo (R$ X × N dias ÷ 30)" / "Base de cálculo (R$ X × N mês/meses)") sai do closing-flow.tsx para uma
  função, SEM mudar um carácter do que o Fechamento mostra. A função recebe o valor mensal JÁ FORMATADO por quem chama
  (ORDEM-DUET-1154): o Fechamento continua em reais inteiros (formatBRL).
  A trava: o texto da função é idêntico ao da expressão que estava no Fechamento, para 31 dias e para 2 meses (e 1 mês);
  e o Fechamento passa a chamá-la, sem a frase escrita à mão.
  Roda: node --test src/lib/e1067-base-de-calculo-extraida.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatBRL } from "./utils.ts";
import * as modulo from "./base-de-calculo.ts";

const textoBaseDeCalculo = (modulo as unknown as { textoBaseDeCalculo?: (mensal: string, d: { dias: number | null | undefined; meses: number }) => string }).textoBaseDeCalculo;

/** A expressão que estava no closing-flow.tsx, copiada como estava (o "antes"). */
const antes = (monthlyRent: number, DIAS_ACORDO: number | null | undefined, prazoMeses: number) =>
  DIAS_ACORDO ? `Base de cálculo (${formatBRL(monthlyRent)} × ${DIAS_ACORDO} dias ÷ 30)` : `Base de cálculo (${formatBRL(monthlyRent)} × ${prazoMeses} ${prazoMeses === 1 ? "mês" : "meses"})`;

for (const [nome, rent, dias, meses] of [
  ["31 dias", 2500, 31, 2],
  ["2 meses", 3200, undefined, 2],
  ["1 mês", 3200, null, 1],
  ["45 dias, valor com centavos (o Fechamento arredonda)", 2583.33, 45, 2],
] as const) {
  test(`o texto da base de cálculo idêntico antes e depois — ${nome}`, () => {
    assert.equal(typeof textoBaseDeCalculo, "function", "base-de-calculo.ts exporta textoBaseDeCalculo");
    assert.equal(textoBaseDeCalculo!(formatBRL(rent), { dias, meses }), antes(rent, dias, meses));
  });
}

test("o Fechamento chama a função, com o mensal em reais inteiros, e já não escreve a frase à mão", () => {
  const f = readFileSync(new URL("../app/(dashboard)/dashboard/fechamento/closing-flow.tsx", import.meta.url), "utf8");
  assert.match(f, /textoBaseDeCalculo\(formatBRL\(PROPERTY\.monthlyRent\), \{ dias: DIAS_ACORDO, meses: prazoMeses \}\)/);
  assert.doesNotMatch(f, /`Base de cálculo \(/);
});
