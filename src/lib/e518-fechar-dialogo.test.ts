/*
  E518 (GRAVE, resto — qa-cliques-morador-p1-2026-11-02 D2): o diálogo "Pedir para morar" (passos 1–3) não tinha
  Fechar/X e o Esc não fechava (o botão de enviar no Passo 3 já foi resolvido no #2399). Agora: um X no topo de todos os
  passos e o Esc fecha — exceto durante o envio, para não abandonar um pedido no meio.
  Roda: node --test src/lib/e518-fechar-dialogo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync("src/app/(public)/imoveis/[id]/property-detail.tsx", "utf8");
const dialogo = s.slice(s.indexOf("const solicitacao = solicitacaoAberta && ("), s.indexOf("// Total pela duração escolhida"));

test("todos os passos têm o X de fechar (rótulo acessível)", () => {
  assert.match(dialogo, /data-testid="solicitacao-fechar"/);
  assert.match(dialogo, /aria-label="Fechar"/);
  assert.match(dialogo, /<X className=/);
});

test("Esc fecha o diálogo (fora do envio)", () => {
  assert.match(s, /if \(e\.key === "Escape" && pending === null\) setSolicitacaoAberta\(false\);/);
  assert.match(s, /window\.addEventListener\("keydown", aoTeclar\)/);
  assert.match(s, /window\.removeEventListener\("keydown", aoTeclar\)/);
});

test("o Passo 3 segue com o botão de enviar (o #2399 não regride)", () => {
  assert.match(dialogo, /"Enviar candidatura"/);
});
