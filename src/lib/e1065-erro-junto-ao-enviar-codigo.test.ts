/*
  E1065 — trava: na assinatura do contrato, o motivo de o código não sair aparece JUNTO do botão "Enviar código por
  e-mail", na hora — e não mais abaixo, depois do campo do código, junto do botão de assinar.
  A tela é cobrada pela t1705; aqui a guarda barata de que cada erro fica junto do botão que o causou e de que a página
  entrega ao formulário o que já sabe (o proprietário ainda sem as instruções de entrada).
  Roda: node --test src/lib/e1065-erro-junto-ao-enviar-codigo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG_FALTAM_INSTRUCOES, motivoFaltamInstrucoes } from "./checkin.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const form = ler("components/contrato/assinar-contrato.tsx");
const pagina = ler("components/contrato/contrato-detalhe.tsx");
const inicio = form.indexOf('data-testid="assinar-pedir-area"');
const fim = form.indexOf('htmlFor="assinar-codigo"');
const area = form.slice(inicio, fim);

test("E1065 — a área do botão do código existe e fecha antes do campo do código", () => {
  assert.ok(inicio > 0 && fim > inicio);
  assert.match(area, /data-testid="assinar-pedir-codigo"/);
});

test("E1065 — a recusa do pedido do código aparece na área do botão que o pediu", () => {
  assert.match(area, /\{erro \? \(\s*<p role="alert"[^>]*data-testid="assinar-pedir-erro">\s*\{erro\}/);
  const pedir = form.slice(form.indexOf("async function pedir()"), form.indexOf("async function assinar("));
  assert.match(pedir, /setErro\(r\.error \?\? "Não foi possível enviar o código\."\)/);
  assert.doesNotMatch(pedir, /setErroAssinar\(/);
});

test("E1065 — o motivo que a página já conhece aparece ali antes do clique, no mesmo lugar da recusa", () => {
  assert.match(form, /const pendencia = faltamInstrucoes && !enviado && !erro;/);
  assert.match(area, /\) : pendencia \? \(\s*<p role="status"[^>]*data-testid="assinar-pedir-pendencia">\s*\{MSG_FALTAM_INSTRUCOES\}/);
});

test("E1065 — o caminho para as instruções fica junto do botão, com área de toque, e leva à seção da página", () => {
  assert.match(area, /\{caminhoDasInstrucoes && \(\s*<a href="#checkin-painel" className="[^"]*\bmin-h-11\b[^"]*">\s*Preencher as instruções de entrada/);
  assert.match(pagina, /<Panel id="checkin-painel"/);
});

test("E1065 — o erro de assinar fica junto do botão de assinar, fora da área do código", () => {
  assert.doesNotMatch(area, /erroAssinar/);
  const depois = form.slice(fim);
  assert.match(depois, /\{erroAssinar && \(\s*<p role="alert"[^>]*data-testid="assinar-erro">[\s\S]{0,80}\{erroAssinar\}[\s\S]{0,120}data-testid="assinar-enviar"/);
  const assinar = form.slice(form.indexOf("async function assinar("), form.indexOf("if (assinado) return null"));
  assert.doesNotMatch(assinar, /setErro\(/);
});

test("E1065 — a página entrega ao formulário o que já sabe, pela mesma regra do servidor", () => {
  assert.match(pagina, /<AssinarContrato contratoId=\{c\.id\} faltamInstrucoes=\{!!checkin && motivoFaltamInstrucoes\(\{ papel: c\.papel, preenchidas: checkin\.preenchidas \}\) !== null\} \/>/);
  // A regra: só o proprietário, e só enquanto as instruções não estão preenchidas.
  assert.equal(motivoFaltamInstrucoes({ papel: "proprietario", preenchidas: false }), MSG_FALTAM_INSTRUCOES);
  assert.equal(motivoFaltamInstrucoes({ papel: "proprietario", preenchidas: true }), null);
  assert.equal(motivoFaltamInstrucoes({ papel: "inquilino", preenchidas: false }), null);
});

test("E1065 — a recusa por falta das instruções sai sozinha quando a página passa a saber que foram preenchidas", () => {
  assert.match(form, /if \(!faltamInstrucoes\) setErro\(\(e\) => \(e === MSG_FALTAM_INSTRUCOES \? null : e\)\);/);
  assert.match(form, /if \(r\.error === MSG_FALTAM_INSTRUCOES\) router\.refresh\(\);/);
});
