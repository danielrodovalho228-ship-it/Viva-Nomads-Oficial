/*
  Carteira do dono, "Vencimentos": a faixa sem contrato dizia só "Nenhum". Agora diz o que não há: contrato terminando
  naquela faixa (as faixas contam os dias até o fim do contrato, carteira-dono.ts).
  Roda: node --test src/lib/painel/vazio-carteira-vencimentos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const TELA = readFileSync(new URL("../../app/(dashboard)/dashboard/carteira/carteira-client.tsx", import.meta.url), "utf8");
const REGRA = readFileSync(new URL("../carteira-dono.ts", import.meta.url), "utf8");

test("a faixa vazia diz que nenhum contrato termina nela, com testid por faixa", () => {
  assert.doesNotMatch(TELA, />Nenhum</);
  assert.match(TELA, /data-testid=\{`carteira-vence-\$\{faixa\}-vazio`\}>Nenhum contrato termina nesta faixa\.</);
  // As faixas são dias até o FIM do contrato: o texto continua verdadeiro.
  assert.match(REGRA, /vence30: comFim\.filter\(\(i\) => \(i\.diasAteFim \?\? 0\) <= 30\)/);
});
