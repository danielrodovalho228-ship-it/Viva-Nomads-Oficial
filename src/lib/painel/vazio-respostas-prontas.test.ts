/*
  Admin › Atendimento, "Respostas prontas": a lista vazia dizia só "Nenhuma ainda.". Agora diz o que salvar e onde a
  resposta aparece. O teste prende o texto ao uso real no chamado (seletor "Resposta pronta" e a troca de {nome}).
  Roda: node --test src/lib/painel/vazio-respostas-prontas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const RAIZ = new URL("../../../", import.meta.url);
const LISTA = readFileSync(new URL("src/app/(dashboard)/admin/atendimento/atendimento-client.tsx", RAIZ), "utf8");
const CHAMADO = readFileSync(new URL("src/app/(dashboard)/admin/atendimento/[id]/chamado-client.tsx", RAIZ), "utf8");

test("a lista vazia explica o que fazer e onde a resposta aparece, com testid", () => {
  assert.doesNotMatch(LISTA, />Nenhuma ainda\.</);
  assert.match(LISTA, /data-testid="respostas-prontas-vazio"/);
  assert.match(LISTA, /Nenhuma resposta pronta ainda\. Salve uma no formulário acima: ela aparece em &quot;Resposta pronta&quot;, no Responder de cada chamado/);
});

test("o que o texto promete é o que o chamado faz: 'Resposta pronta' no Responder e {nome} trocado", () => {
  assert.match(CHAMADO, /<Panel title="Responder"/);
  assert.match(CHAMADO, /Resposta pronta/);
  assert.match(CHAMADO, /m\.corpo\.replaceAll\("\{nome\}", nome\)/);
});
