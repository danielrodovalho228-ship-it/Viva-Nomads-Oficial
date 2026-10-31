/*
  Ordem de manutenção sem mensagens: cada lado lê com quem fala e o que conta, no lugar de "Nenhuma mensagem ainda.".
  Roda: node --test src/lib/manutencao-mensagens-vazio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { textoMensagensOrdemVazia } from "./manutencao-solicitacoes.ts";

const CARTAO = readFileSync(new URL("../components/manutencao/cartao-ordem.tsx", import.meta.url), "utf8");
const ACOES = readFileSync(new URL("./data/manutencao-actions.ts", import.meta.url), "utf8");

test("proprietário: fala com o inquilino e a primeira mensagem conta como resposta (a regra do servidor)", () => {
  const t = textoMensagensOrdemVazia("proprietario");
  assert.match(t, /para o inquilino/);
  assert.match(t, /primeira mensagem já conta como resposta ao chamado/);
  assert.match(ACOES, /alvo\.papel === "proprietario" && !alvo\.ordem\.first_response_at/);
});

test("inquilino: fala com o proprietário sobre o reparo", () => {
  const t = textoMensagensOrdemVazia("inquilino");
  assert.match(t, /para o proprietário sobre este reparo/);
  assert.doesNotMatch(t, /conta como resposta/);
});

test("o cartão usa o texto por papel, com testid, e não o genérico", () => {
  assert.doesNotMatch(CARTAO, />Nenhuma mensagem ainda\.</);
  assert.match(CARTAO, /data-testid="mensagens-ordem-vazio">\{textoMensagensOrdemVazia\(papel\)\}/);
});
