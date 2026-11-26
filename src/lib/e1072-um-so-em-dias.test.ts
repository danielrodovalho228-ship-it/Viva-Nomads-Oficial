/*
  E1072 — nota do desenho da pilha (ORDENS-DUET 1054 e 1095): um só "em dias". A decisão "a estadia conta-se em dias
  (não fecha meses cheios)" tem UMA fonte, `estadiaEmDias(dias)`, e quem pergunta isso no fluxo do pagamento do bloco
  lê dela: o fator do bloco (`fatorDoBloco`, a carga do contrato) e o 1º pagamento antes do contrato
  (`componentesDoPrimeiroPagamento`). Antes, cada um decidia à sua maneira (`prazoTotalDias % 30 !== 0` sem arredondar,
  e `Math.round(dias) % 30 === 0`). O `duracaoDoBloco` do E1067 (#4078) lerá desta fonte na fusão dele.
  Roda: node --test src/lib/e1072-um-so-em-dias.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as componentes from "./pagamento-componentes.ts";
import { fonteSemComentarios } from "./fonte-sem-comentarios.ts";

const { fatorDoBloco, componentesDoPrimeiroPagamento } = componentes;
const estadiaEmDias = (componentes as unknown as { estadiaEmDias?: (dias: number | null | undefined) => boolean }).estadiaEmDias;

test("a fonte única: estadiaEmDias(dias) — dias que não fecham meses cheios; meses cheios, zero, vazio e lixo → não", () => {
  assert.equal(typeof estadiaEmDias, "function", "pagamento-componentes exporta estadiaEmDias");
  for (const d of [31, 45, 61, 1, 30.6]) assert.equal(estadiaEmDias!(d), true, `${d} dias`);
  for (const d of [30, 60, 180, 29.6, 0, -31, null, undefined, Number.NaN]) assert.equal(estadiaEmDias!(d as number), false, `${d}`);
});

test("o fator do bloco e o 1º pagamento decidem pelo MESMO critério (também na borda do arredondamento)", () => {
  const bloco = { meses: 1, inicio: "2027-01-01", fim: "2027-01-31" }; // 31 dias inclusivos
  // 59,6 dias arredonda a 60 (meses cheios): o 1º pagamento já dizia "meses"; o fator do bloco tem de dizer o mesmo.
  assert.equal(fatorDoBloco(bloco, 59.6), 1, "59,6 → meses cheios: o fator é o dos meses");
  assert.equal(fatorDoBloco(bloco, 61), 31 / 30, "61 → em dias: o fator é dias ÷ 30");
  const preco = { mensal: 2500, totalPorMes: 2800, totalContrato: 5600, unicos: [] };
  assert.equal(componentesDoPrimeiroPagamento({ dias: 59.6, preco, blocos: [{ numero: 1, valor: 5000, meses: 2 }], comProposta: true }), null, "59,6 → meses cheios: sem conta em dias");
});

test("no código: um só sítio decide '% 30' no pagamento-componentes, e as duas funções leem dele", () => {
  const s = fonteSemComentarios(readFileSync(new URL("./pagamento-componentes.ts", import.meta.url), "utf8"));
  assert.equal((s.match(/% 30/g) ?? []).length, 1, "só a estadiaEmDias faz a conta");
  assert.match(s, /export function fatorDoBloco[\s\S]*?estadiaEmDias\(prazoTotalDias\)/);
  assert.match(s, /export function componentesDoPrimeiroPagamento[\s\S]*?estadiaEmDias\(/);
});
