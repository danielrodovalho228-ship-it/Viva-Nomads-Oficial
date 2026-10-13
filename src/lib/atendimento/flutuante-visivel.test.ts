import { test } from "node:test";
import assert from "node:assert/strict";
import { cruzaCantoDoFlutuante, ehCampoDeFormulario, flutuanteVisivel } from "./flutuante-visivel.ts";

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

test("t59: só controle que cruza o canto do botão redondo o faz sair; CTA em outro ponto da faixa de baixo não", () => {
  // janela 390×800; botão ocupa ~ x 326–374, y 728–776
  assert.equal(cruzaCantoDoFlutuante({ left: 16, top: 730, right: 374, bottom: 780 }, 390, 800), true, "CTA de largura cheia sobre o canto");
  assert.equal(cruzaCantoDoFlutuante({ left: 16, top: 730, right: 200, bottom: 780 }, 390, 800), false, "CTA só à esquerda");
  assert.equal(cruzaCantoDoFlutuante({ left: 16, top: 600, right: 374, bottom: 650 }, 390, 800), false, "CTA acima do canto");
  assert.equal(cruzaCantoDoFlutuante({ left: 0, top: 0, right: 0, bottom: 0 }, 390, 800), false, "sem tamanho (oculto)");
});
