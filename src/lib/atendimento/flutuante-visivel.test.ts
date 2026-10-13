import { test } from "node:test";
import assert from "node:assert/strict";
import { ehCampoDeFormulario, flutuanteVisivel } from "./flutuante-visivel.ts";

test("F49: campo de texto/e-mail/busca/textarea/select em foco = é campo", () => {
  for (const [tag, tipo] of [["INPUT", "text"], ["INPUT", "email"], ["INPUT", "search"], ["INPUT", null], ["TEXTAREA", null], ["SELECT", null]] as const) {
    assert.equal(ehCampoDeFormulario(tag, tipo), true, `${tag}/${tipo}`);
  }
});

test("F49: botão, checkbox e links em foco NÃO são campo", () => {
  for (const [tag, tipo] of [["INPUT", "submit"], ["INPUT", "checkbox"], ["INPUT", "radio"], ["BUTTON", null], ["A", null], [undefined, null]] as const) {
    assert.equal(ehCampoDeFormulario(tag, tipo), false, `${tag}/${tipo}`);
  }
});

test("F49: some com campo em foco ou CTA na faixa; volta quando liberado; chat aberto nunca some", () => {
  assert.equal(flutuanteVisivel({ chatAberto: false, campoEmFoco: true, ctaNaFaixa: false }), false);
  assert.equal(flutuanteVisivel({ chatAberto: false, campoEmFoco: false, ctaNaFaixa: true }), false);
  assert.equal(flutuanteVisivel({ chatAberto: false, campoEmFoco: false, ctaNaFaixa: false }), true);
  assert.equal(flutuanteVisivel({ chatAberto: true, campoEmFoco: true, ctaNaFaixa: true }), true);
});
