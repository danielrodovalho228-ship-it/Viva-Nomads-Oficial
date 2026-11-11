import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
  Rodada completa 5eb1fad9 (42a48ade, 10/11): t161 "calendário: legenda tem Indisponível" não achava a palavra.
  Desde o E666 a legenda diz as DUAS causas de um dia fechado — "Ocupado (já reservado)" e "Bloqueado pelo
  proprietário" — e a nota "Dias na cor clara estão livres para pedir…". A spec passa a cobrar esses rótulos.
*/
test("t161: a legenda do calendário usa os rótulos do E666, não 'Indisponível'", () => {
  const tela = readFileSync("src/components/property/availability-calendar.tsx", "utf8");
  assert.match(tela, /export const ROTULO_OCUPADO = "Ocupado \(já reservado\)";/);
  assert.match(tela, /export const ROTULO_BLOQUEADO = "Bloqueado pelo proprietário";/);
  assert.match(tela, /\{ROTULO_OCUPADO\}/);
  assert.match(tela, /\{ROTULO_BLOQUEADO\}/);
  assert.doesNotMatch(tela, />\s*Indisponível\s*</, "a palavra solta 'Indisponível' não está mais na legenda");

  const spec = readFileSync("tests/e2e/specs/t161-coerencia-imovel.spec.ts", "utf8");
  const teste = spec.slice(spec.indexOf('test("calendário'));
  assert.ok(teste.length > 0, "a spec tem o teste do calendário");
  assert.doesNotMatch(teste, /getByText\("Indisponível"\)/);
  assert.match(teste, /getByTestId\("calendario-legenda"\)/);
  assert.match(teste, /Ocupado \(já reservado\)/);
  assert.match(teste, /Bloqueado pelo proprietário/);
});
