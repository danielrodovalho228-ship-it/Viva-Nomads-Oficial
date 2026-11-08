/*
  E506 (reprovado de novo na prova pós-merge de 07/11) — para um rascunho 57% completo, a barra "Progresso do cadastro" do /qualificar
  lia 0 na tela 1/5 e subia 2 por tela (2/4/6/8, resultado 10): acompanhava os PASSOS do assistente, não o progresso do rascunho.
  Agora a barra nunca fica abaixo do % completo real do rascunho (a prontidão, fonte única do "X% completo" de todas as telas).
  Roda: node --test src/lib/anuncio/e506-barra-do-rascunho.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { progressoQualificacao, progressoQualificacaoComRascunho } from "./assistente-telas.ts";

test("E506: rascunho 57% completo — a barra lê 57 em TODAS as telas, não 0/2/4/6/8", () => {
  for (const tela of [0, 1, 2, 3, 4]) assert.equal(progressoQualificacaoComRascunho(tela, 5, 10, 0, 57), 57, `tela ${tela + 1}`);
  assert.equal(progressoQualificacaoComRascunho(5, 5, 10, 0, 57), 57, "resultado");
});

test("E506: rascunho vazio mantém o comportamento de antes (passos e respostas)", () => {
  for (const tela of [0, 1, 2, 3, 4, 5]) assert.equal(progressoQualificacaoComRascunho(tela, 5, 10, 0, 0), progressoQualificacao(tela, 5, 10, 0));
  assert.equal(progressoQualificacaoComRascunho(0, 5, 10, 0.5, 0), progressoQualificacao(0, 5, 10, 0.5));
});

test("E506: nunca regride, nunca passa de 100 e ignora valores inválidos", () => {
  assert.equal(progressoQualificacaoComRascunho(4, 5, 10, 0, 3), progressoQualificacao(4, 5, 10, 0), "3% não puxa para baixo");
  assert.equal(progressoQualificacaoComRascunho(0, 5, 10, 0, 140), 100);
  assert.equal(progressoQualificacaoComRascunho(0, 5, 10, 0, Number.NaN), 0);
  assert.equal(progressoQualificacaoComRascunho(0, 5, 10, 0, -20), 0);
});

test("E506: a tela passa o % da prontidão do rascunho para a barra", () => {
  const q = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/qualificacao.tsx", import.meta.url), "utf8");
  assert.match(q, /progressoQualificacaoComRascunho\(resultado \? TOTAL_TELAS : p\.tela, TOTAL_TELAS, 10, fracaoDaQualificacao\(respondidas, confortoAgora\.length\), p\.progressoRascunho \?\? 0\)/);
  const pg = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");
  assert.match(pg, /progressoRascunho=\{prontidao\.pct\}/);
});
