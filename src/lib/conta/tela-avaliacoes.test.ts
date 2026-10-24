/* A2 — Conta › Avaliações (perfil-02). Roda: node --test src/lib/conta/tela-avaliacoes.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SUBTITULO_AVALIACOES, estrelasDaNota, primeiraSemResposta } from "./tela-avaliacoes.ts";
import { TEXTO_PROIBIDO } from "../estilo/estilo-padrao.test.ts";

test("subtítulo do desenho no vocabulário da casa (sem anfitriões, sem inquilinos)", () => {
  assert.equal(SUBTITULO_AVALIACOES, "Avaliações que você recebeu de proprietários e moradores");
  assert.doesNotMatch(SUBTITULO_AVALIACOES, /anfitri|inquilin|h[oó]spede|reserva/i);
  assert.doesNotMatch(SUBTITULO_AVALIACOES, TEXTO_PROIBIDO);
});

test("estrelas: arredonda e fica entre 0 e 5", () => {
  assert.equal(estrelasDaNota(5), 5);
  assert.equal(estrelasDaNota(4.5), 5);
  assert.equal(estrelasDaNota(4.4), 4);
  assert.equal(estrelasDaNota(0), 0);
  assert.equal(estrelasDaNota(9), 5);
  assert.equal(estrelasDaNota(Number.NaN), 0);
});

test("'Responder avaliações' leva à primeira sem resposta; sem nenhuma, some", () => {
  assert.equal(primeiraSemResposta([{ id: "a", resposta: "ok" }, { id: "b", resposta: null }, { id: "c", resposta: null }]), "b");
  assert.equal(primeiraSemResposta([{ id: "a", resposta: "ok" }]), null);
  assert.equal(primeiraSemResposta([]), null);
});

test("a tela usa os dados e as regras da Pista B e o mesmo Responder/Pedir revisão do painel", () => {
  const t = readFileSync(new URL("../../app/(dashboard)/dashboard/conta/avaliacoes/page.tsx", import.meta.url), "utf8");
  assert.match(t, /avaliacoesRecebidas\(\)/);
  assert.match(t, /filtrarAvaliacoes\(/);
  assert.match(t, /linhaContextoAvaliacao\(a\)/);
  assert.match(t, /<AcoesAvaliacao\b/);
  assert.match(t, /<CascaConta ativo="avaliacoes"/);
  for (const id of ["avaliacoes-aba-", "avaliacoes-busca", "avaliacao-estrelas", "avaliacoes-responder"]) assert.match(t, new RegExp(id), id);
});
