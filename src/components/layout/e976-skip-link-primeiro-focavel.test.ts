/*
  E976 — o link "Pular para o conteúdo principal" é o primeiro focável da página (WCAG 2.4.1); o botão flutuante "Fale
  com a Viva" nunca recebe o primeiro Tab.
  Causa: o layout raiz desenhava o flutuante ANTES do conteúdo da página, e o skip-link vem dentro do conteúdo (layout
  público). Como a ordem do Tab é a ordem do documento, o primeiro Tab caía no flutuante. A correção é de ordem no
  documento: o flutuante vem depois do conteúdo (ele é fixo na tela — não muda de lugar).
  Roda: node --test src/components/layout/e976-skip-link-primeiro-focavel.test.ts
  A spec de trava ao vivo é da Pista 3.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const raiz = readFileSync("src/app/layout.tsx", "utf8");
const publico = readFileSync("src/app/(public)/layout.tsx", "utf8");
const corpo = raiz.slice(raiz.indexOf("<body"), raiz.indexOf("</body>"));

test("E976: no layout raiz, o conteúdo da página vem antes do flutuante 'Fale com a Viva'", () => {
  const conteudo = corpo.indexOf("{children}");
  const flutuante = corpo.indexOf("<VivaChatFlutuante />");
  assert.ok(conteudo > 0 && flutuante > 0, "os dois estão no corpo");
  assert.ok(conteudo < flutuante, "o conteúdo (com o skip-link) vem antes do flutuante na ordem do documento");
  assert.equal(corpo.split("<VivaChatFlutuante />").length - 1, 1, "um flutuante só");
});

test("E976: nada focável do site vem antes do conteúdo no layout raiz (o que fica antes não desenha nada na web)", () => {
  const antes = corpo.slice(0, corpo.indexOf("{children}"));
  const componentes = [...antes.matchAll(/<([A-Z]\w+)\b/g)].map((m) => m[1]);
  // Provedor de sessão e pontes sem tela; PushApp e LinksDoApp só desenham no app (fora da web devolvem null).
  assert.deepEqual(componentes, ["AuthProvider", "AppModeBridge", "PushApp", "OrigemVisita", "LinksDoApp", "ValidacaoPtBr"]);
  assert.doesNotMatch(antes, /<a\b|<button\b|tabIndex/);
});

test("E976: no layout público, o skip-link é o primeiro elemento focável e aponta para o conteúdo", () => {
  const retorno = publico.slice(publico.indexOf("return ("));
  const primeiroFocavel = retorno.search(/<a\b|<button\b|<Navbar\b|<AppHeader\b|<AvisoTestes\b/);
  assert.equal(retorno.slice(primeiroFocavel, primeiroFocavel + 80).startsWith('<a href="#conteudo" className="skip-link">'), true);
  assert.match(publico, /<main id="conteudo"/);
  // Sem ordem de Tab forçada (tabIndex positivo é atalho que quebra a ordem natural).
  assert.doesNotMatch(publico + raiz, /tabIndex=\{[1-9]/);
});
