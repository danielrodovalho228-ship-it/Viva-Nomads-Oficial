// E737 (QA, lab 08/11): em 9 de 12 páginas a 1280 px, o 1º Tab caía no botão flutuante "Fale com a Viva" antes do link "Pular para o
// conteúdo". O botão estava antes do conteúdo no DOM (layout raiz). Agora vem depois dele (é fixo: a posição na tela não muda), e o
// link "Pular para o conteúdo" do layout público passa a ser o primeiro foco da página.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const raiz = readFileSync("src/app/layout.tsx", "utf8");
const publico = readFileSync("src/app/(public)/layout.tsx", "utf8");

test("E737: no layout raiz o botão flutuante vem DEPOIS de {children} (o link 'Pular para o conteúdo' vem antes na ordem de foco)", () => {
  const filhos = raiz.indexOf("{children}");
  const flutuante = raiz.indexOf("<VivaChatFlutuante />");
  assert.ok(filhos > 0 && flutuante > filhos, "flutuante depois de {children}");
});

test("E737: o 'Pular para o conteúdo' continua sendo o primeiro elemento do layout público", () => {
  const skip = publico.indexOf('className="skip-link"');
  assert.ok(skip > 0);
  assert.ok(skip < publico.indexOf("<Navbar"), "antes do menu");
});
