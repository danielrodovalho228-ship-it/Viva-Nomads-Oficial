/*
  Conta › Meu local de trabalho: sem local salvo, dizia só "Nenhum local salvo.". Agora diz o próximo passo, com o nome
  do botão que salva (o "para quê" já está no parágrafo logo acima: busca, alertas e pedido de moradia).
  Roda: node --test src/lib/vazio-local-trabalho.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const BLOCO = readFileSync(new URL("../components/account/meu-local-trabalho.tsx", import.meta.url), "utf8");

test("sem local salvo: o próximo passo com o nome do botão que salva", () => {
  assert.doesNotMatch(BLOCO, /"Nenhum local salvo\."/);
  assert.match(BLOCO, /Nenhum local salvo ainda: escolha abaixo o lugar e como você vai até ele, e toque em \\"Salvar local de trabalho\\"\./);
  assert.match(BLOCO, /\{pendente \? "Salvando…" : "Salvar local de trabalho"\}/);
  // O para quê continua logo acima, e o testid da linha não mudou (t261).
  assert.match(BLOCO, /Usamos para mostrar o tempo até o trabalho na busca, nos\s+alertas e no pedido de moradia\./);
  assert.match(BLOCO, /data-testid="local-salvo"/);
});
