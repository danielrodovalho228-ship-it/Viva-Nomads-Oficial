import { test } from "node:test";
import assert from "node:assert/strict";
import { elevacaoDoFlutuante, ehCampoDeFormulario, flutuanteVisivel } from "./flutuante-visivel.ts";

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

test("4f8d17c6: só some com campo em foco (teclado); chat aberto nunca some", () => {
  assert.equal(flutuanteVisivel({ chatAberto: false, campoEmFoco: true }), false);
  assert.equal(flutuanteVisivel({ chatAberto: false, campoEmFoco: false }), true);
  assert.equal(flutuanteVisivel({ chatAberto: true, campoEmFoco: true }), true);
});

test("4f8d17c6: em vez de sumir, sobe só o necessário para não tampar o controle", () => {
  // janela 390×800; botão em repouso: x 214–374, y 728–776
  const botao = { left: 214, top: 728, right: 374, bottom: 776 };
  assert.equal(elevacaoDoFlutuante(botao, [], 400), 0, "nada embaixo");
  assert.equal(elevacaoDoFlutuante(botao, [{ left: 16, top: 600, right: 374, bottom: 650 }], 400), 0, "CTA acima do botão");
  assert.equal(elevacaoDoFlutuante(botao, [{ left: 16, top: 730, right: 150, bottom: 780 }], 400), 0, "CTA só à esquerda");
  // CTA de largura cheia sob o botão: sobe até o botão ficar 8 px acima dele.
  assert.equal(elevacaoDoFlutuante(botao, [{ left: 16, top: 730, right: 374, bottom: 780 }], 400), 776 - 730 + 8);
  // Dois controles empilhados: sobe acima dos dois.
  const dois = [
    { left: 16, top: 730, right: 374, bottom: 780 },
    { left: 16, top: 670, right: 374, bottom: 720 },
  ];
  assert.equal(elevacaoDoFlutuante(botao, dois, 400), 776 - 670 + 8);
  assert.equal(elevacaoDoFlutuante(botao, dois, 50), 50, "respeita o limite");
  assert.equal(elevacaoDoFlutuante(botao, [{ left: 0, top: 0, right: 0, bottom: 0 }], 400), 0, "controle oculto");
});
