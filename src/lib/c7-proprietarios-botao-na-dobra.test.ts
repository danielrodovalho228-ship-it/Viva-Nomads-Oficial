import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pagina = readFileSync("src/app/(public)/para-proprietarios/page.tsx", "utf8");

// C7 (QA, 07/11): no celular o banner tinha 15 linhas de texto antes do botão; "Anunciar meu imóvel" ficava atrás da
// navegação de baixo (390 × 844) e 221 px abaixo da dobra (360 × 640). O mockup tem texto curto + botão logo abaixo.
// A ação principal vem logo depois do primeiro parágrafo; a frase da taxa (texto igual) desce para depois do botão.
test("o botão 'Anunciar meu imóvel' vem antes do parágrafo da taxa de serviço no banner", () => {
  const botao = pagina.indexOf("Anunciar meu imóvel");
  const taxa = pagina.indexOf("Anuncie de graça.");
  const primeiro = pagina.indexOf("Locação mobiliada de média duração");
  assert.ok(primeiro > 0 && botao > primeiro, "o botão vem depois do 1º parágrafo");
  assert.ok(taxa > botao, "a frase da taxa vem depois do botão");
});

test("a frase da taxa segue dentro do banner, com o texto de sempre", () => {
  const banner = pagina.slice(pagina.indexOf("<BannerTopo"), pagina.indexOf("</BannerTopo>"));
  assert.match(banner, /Anuncie de graça\.[\s\S]{0,200}taxa de serviço da Viva é de \{TAXA_MAIOR\}/);
  assert.match(banner, /Sem mensalidade/);
});
