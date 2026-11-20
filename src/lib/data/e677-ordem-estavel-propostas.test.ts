/*
  E677 (07/11, retomada do E652): na lista de Orçamentos do inquilino1, a "mesma proposta" lia ORC-2026-0007 às 02:46 e
  ORC-2026-0013 às 02:57, com a contagem inalterada (5).
  Evidência (leitura da produção): os números não mudam — `propostas.numero` é único e igual ao do registro único. O que
  muda é a ORDEM: a lista ordenava por `atualizada_em` (e abrir uma proposta a marca como "vista" e a sobe para o topo), e
  as propostas de teste do mesmo imóvel só se distinguem pelo número. A linha da mesma posição passava a ser outra
  proposta. A ordem agora é a do envio (`criada_em`), que não muda sem ação da pessoa.
  Roda: node --test src/lib/data/e677-ordem-estavel-propostas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fonte = readFileSync(new URL("./propostas-actions.ts", import.meta.url), "utf8");
const lista = fonte.slice(fonte.indexOf("export async function listarPropostas"), fonte.indexOf("export async function contarPropostasAguardando"));

test("E677: a lista de propostas ordena pelo envio (criada_em) e desempata pelo número, não pela última atualização", () => {
  assert.doesNotMatch(lista, /order\("atualizada_em"/);
  assert.match(lista, /\.order\("criada_em", \{ ascending: false \}\)\s*\.order\("numero", \{ ascending: false \}\)/);
});

test("E677: o número exibido é o da própria proposta (nunca recalculado na lista)", () => {
  assert.match(lista, /numero: p\.numero,/);
});
