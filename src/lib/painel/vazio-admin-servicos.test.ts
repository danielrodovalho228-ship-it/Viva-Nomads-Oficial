/*
  Admin › Serviços: a lista vazia dizia só "Nenhum pedido ainda.". Agora diz de onde o pedido vem (Serviços, no painel do
  morador) e o que a lista mostra (prestador, data desejada, estado), preso aos campos reais do item.
  Roda: node --test src/lib/painel/vazio-admin-servicos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PAGINA = readFileSync(new URL("../../app/(dashboard)/admin/servicos/page.tsx", import.meta.url), "utf8");

test("a lista vazia diz de onde o pedido vem e o que aparece nele, com testid", () => {
  assert.doesNotMatch(PAGINA, />Nenhum pedido ainda\.</);
  assert.match(PAGINA, /data-testid="admin-servicos-vazio">Nenhum pedido de serviço dos moradores ainda\. Cada pedido feito em Serviços, no painel do morador, aparece aqui com o prestador, a data desejada e o estado/);
});

test("o item da lista mostra o que o texto promete: prestador, data desejada e estado", () => {
  assert.match(PAGINA, /p\.prestador/);
  assert.match(PAGINA, /dataBR\(p\.dataDesejada\)/);
  assert.match(PAGINA, /rotuloEstado\(p\.status\)/);
});
