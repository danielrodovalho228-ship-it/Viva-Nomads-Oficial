import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
  Rodada completa 5eb1fad9 (42a48ade, 10/11): t564 "Passo 5: comodidades em pílulas" contava 23 comodidades e 0 com
  data-pilula-assistente. No reteste do E193 (30/10, ordem do Daniel de 25/10) as comodidades do Passo 5 passaram ao
  CARTÃO GRANDE tocável da Qualificação (CartaoEscolha, data-cartao-assistente, rounded-xl, em grade), o mesmo do resto
  do assistente. A spec passa a cobrar o cartão, não a pílula.
*/
test("t564: o Passo 5 desenha cada comodidade no CartaoEscolha", () => {
  const etapa = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx", "utf8");
  const bloco = etapa.slice(etapa.indexOf("<CartaoEscolha"), etapa.indexOf("data-comodidade={it.key}") + 30);
  assert.ok(bloco.length > 30, "a comodidade do Passo 5 é um CartaoEscolha com data-comodidade");
  const ui = readFileSync("src/components/anuncio/escolha-assistente.tsx", "utf8");
  const cartao = ui.slice(ui.indexOf("export function CartaoEscolha"));
  assert.match(cartao, /data-cartao-assistente/);
  assert.match(cartao, /rounded-xl/);
});

test("t564: a spec do Passo 5 cobra o cartão grande, não a pílula", () => {
  const spec = readFileSync("tests/e2e/specs/t564-e193-qualificacao-cartoes.spec.ts", "utf8");
  const passo5 = spec.slice(spec.indexOf("Passo 5"));
  assert.ok(passo5.length > 0);
  assert.doesNotMatch(passo5, /data-pilula-assistente/);
  assert.match(passo5, /button\[data-comodidade\]\[data-cartao-assistente\]/);
  assert.doesNotMatch(passo5, /toBeGreaterThanOrEqual\(forma\.altura \/ 2/, "não exige mais o raio de pílula");
  assert.match(passo5, /expect\(forma\.raio\)\.toBeLessThan\(forma\.altura \/ 2\)/);
});
