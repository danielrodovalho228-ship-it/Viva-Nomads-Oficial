/*
  Ordem 02d4c903, F41: cada linha do rateio de custos (etapa 5 do Fechamento) mostra o NOME DO CUSTO.
  Nunca o nome do candidato. A tela renderiza item.label de COST_SPLIT_ITEMS; este teste trava a lista.
  Roda: node --test src/lib/fechamento-rateio.test.ts
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COST_SPLIT_ITEMS } from "./closing.ts";

const tela = readFileSync("src/app/(dashboard)/dashboard/fechamento/closing-flow.tsx", "utf8");

test("rateio: toda linha tem chave e nome de custo preenchidos e únicos", () => {
  assert.ok(COST_SPLIT_ITEMS.length >= 5);
  const chaves = COST_SPLIT_ITEMS.map((i) => i.key);
  const nomes = COST_SPLIT_ITEMS.map((i) => i.label.trim());
  assert.equal(new Set(chaves).size, chaves.length);
  assert.equal(new Set(nomes).size, nomes.length);
  for (const n of nomes) assert.ok(n.length > 0);
});

test("rateio: a tela escreve item.label, não o nome do inquilino", () => {
  const bloco = tela.slice(tela.indexOf("COST_SPLIT_ITEMS.map", tela.indexOf("Rateio de custos durante")), tela.indexOf("Resumo de campos dinâmicos"));
  assert.match(bloco, /\{item\.label\}/);
  assert.doesNotMatch(bloco, /tenant\.name/);
});
