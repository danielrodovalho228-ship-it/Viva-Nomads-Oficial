/*
  Admin › Agentes, "Ordens para …": a lista vazia dizia só "Nenhuma ordem ainda.". Agora nomeia o agente e diz como uma
  ordem nasce (um pedido de ação na conversa vira ordem). O teste prende o texto ao fluxo real da central.
  Roda: node --test src/lib/painel/vazio-ordens-agente.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CENTRAL = readFileSync(new URL("../../app/(dashboard)/admin/agentes/central-client.tsx", import.meta.url), "utf8");

test("a lista vazia nomeia o agente e diz como a ordem nasce, com testid", () => {
  assert.doesNotMatch(CENTRAL, />Nenhuma ordem ainda\.</);
  assert.match(CENTRAL, /data-testid="ordens-agente-vazio">Nenhuma ordem para \{a\.nome\} ainda\. Peça uma ação na conversa acima: o pedido vira ordem e aparece aqui, com o estado de cada uma\.</);
});

test("o que o texto promete é o fluxo da central: pedido de ação na conversa vira ordem", () => {
  assert.match(CENTRAL, /\/\/ Pedido de ação: o servidor já respondeu; agora vira ordem/);
  assert.match(CENTRAL, /await deixarOrdem\(alvo\.slug, pergunta\)/);
  assert.match(CENTRAL, /placeholder=\{`Escreva para \$\{a\.nome\}…`\}/);
});
