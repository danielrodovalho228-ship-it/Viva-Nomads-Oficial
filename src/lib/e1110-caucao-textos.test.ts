/*
  E1110 (ORDEM-DUET-494; achados D7 e D8 da auditoria da ORDEM-493): textos de caução fora da regra decidida.
   - D7, Ferramentas do dono: "Caução Viva (50% por bloco, devolvível)" — a regra antiga, por bloco.
   - D8, garantias do cadastro (lib/faixas.ts): "50% antes da entrada; o restante conforme o contrato" — dizia que só
     metade da caução se paga antes da entrada; a regra (E1061/E1082) é a caução toda, de 50% do aluguel da estadia,
     no máximo 3 vezes o valor mensal, antes da entrada (ROTULO_CAUCAO_NA_ENTRADA). REGRAS_CONTRATO não tem regra de
     "metade antes, o resto depois".
  Os dois textos passam a vir da frase-fonte da caução (lib/caucao-regra.ts: REGRA_CAUCAO).
  Roda: node --test src/lib/e1110-caucao-textos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REGRA_CAUCAO } from "./caucao-regra.ts";
import { GARANTIAS_CADASTRO } from "./faixas.ts";

const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");

test("E1110 (D7): as Ferramentas dizem a caução pela frase-fonte — nada de 'por bloco'", () => {
  const f = semComentarios(readFileSync("src/app/(dashboard)/dashboard/ferramentas/page.tsx", "utf8"));
  assert.doesNotMatch(f, /50% por bloco|por bloco/);
  assert.match(f, /Caução Viva: \$\{REGRA_CAUCAO\}, devolvível — o dinheiro nunca fica com a plataforma\./);
});

test("E1110 (D8): a garantia 'Caução' do cadastro diz a regra da fonte, toda antes da entrada", () => {
  const caucao = { microtext: GARANTIAS_CADASTRO.find((g) => g.key === "caucao_avista")?.microtext ?? "" };
  assert.ok(caucao.microtext.includes(REGRA_CAUCAO), "a regra vem da fonte");
  assert.match(caucao.microtext, /antes da entrada/);
  assert.doesNotMatch(caucao.microtext, /o restante conforme o contrato/);
  assert.doesNotMatch(semComentarios(readFileSync("src/lib/faixas.ts", "utf8")), /50% antes da entrada/);
});
