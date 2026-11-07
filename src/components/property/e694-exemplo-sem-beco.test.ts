/*
  E694: anúncio de exemplo não é beco sem saída. A candidatura declara o caráter de exemplo NO TOPO do primeiro passo, não
  oferece "Continuar" (nada de 3 passos para descobrir no fim) e a mensagem declara o exemplo ANTES de a pessoa digitar,
  com a caixa de texto e o "Enviar" desligados. Fora do exemplo nada muda.
  Roda: node --test src/components/property/e694-exemplo-sem-beco.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const detalhe = readFileSync(new URL("../../app/(public)/imoveis/[id]/property-detail.tsx", import.meta.url), "utf8");
const i0 = detalhe.indexOf("const solicitacao = solicitacaoAberta");
const modal = detalhe.slice(i0, detalhe.indexOf("// Total pela duração escolhida"));
const c0 = detalhe.indexOf("const composer = composeKind");
const composer = detalhe.slice(c0, detalhe.indexOf("// Candidatura em etapas", c0));

test("candidatura: o aviso de exemplo vem logo sob o título, antes de qualquer campo", () => {
  const aviso = modal.indexOf('data-testid="solicitacao-demo"');
  assert.ok(aviso > 0, "o aviso existe");
  assert.ok(aviso < modal.indexOf("mensagem-do-dono"), "antes do recado e dos campos");
  assert.ok(aviso < modal.indexOf('data-testid="solicitacao-erro"'));
  assert.equal(modal.split('data-testid="solicitacao-demo"').length, 2, "uma vez só (não repete no fim)");
});

test("candidatura: no exemplo não há barra de passos nem 'Continuar'", () => {
  assert.match(modal, /\{!exemplo && \(\s*<div className="mb-3 pr-12" data-testid="candidatura-progresso">/);
  assert.match(modal, /!exemplo && \(\s*<Button variant="primary" size="sm" disabled=\{!!resumo\.erro\} onClick=\{\(\) => setEtapa\(proximaEtapa\(etapa\)\)\}>/);
});

test("mensagem: o aviso vem antes da caixa de texto, e a caixa e o 'Enviar' ficam desligados no exemplo", () => {
  const aviso = composer.indexOf('data-testid="mensagem-exemplo-aviso"');
  assert.ok(aviso > 0 && aviso < composer.indexOf("<textarea"));
  assert.match(composer, /disabled=\{exemplo\}/);
  assert.match(composer, /disabled=\{exemplo \|\| pending !== null \|\| composeText\.trim\(\)\.length < 3\}/);
});
