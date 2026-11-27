/* Roda: node --test src/components/ui/switch-alvo.test.ts — varredura 01/11 (Pista A): o Switch compartilhado (Conta ›
   Notificações, Pedidos, "Ativo" em Meus imóveis) tinha 24 px de altura de toque no celular. Ganha a área de 44 px de
   .alvo-toque (pseudo-elemento só em tela de toque); o trilho e a bolinha não mudam. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sw = readFileSync(new URL("./switch.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

// Asserção alterada por decisão do coordenador, trazida pelo Gerente (ORDEM-DUET-212, item 3, E1033 passo 2): o Switch
// cobrava a classe alvo-toque, que só dá a área de 44 px em tela de toque. Medido com o helper do passo 1, com rato a
// área real era de 24 px de altura nos 18 interruptores. Passa a cobrar a classe area-de-toque-44, que vale em
// qualquer perfil. O trilho de 24 × 44 px continua cobrado como antes.
test("Switch tem a área de toque de 44 px em qualquer perfil e mantém o trilho de 24 × 44 px", () => {
  assert.match(sw, /"area-de-toque-44 relative inline-flex h-6 w-11 shrink-0/);
  // O ::after é da área de toque: o Switch não pode usar ::after para outra coisa.
  assert.doesNotMatch(sw, /after:/);
  // Já não depende de .alvo-toque (só tela de toque).
  assert.doesNotMatch(sw, /alvo-toque/);
});

test(".area-de-toque-44 vale em qualquer perfil: fora de @media, 44 × 44 no mínimo, centrada e sem desenho", () => {
  const i = css.indexOf(".area-de-toque-44 {");
  assert.ok(i > 0, "a regra .area-de-toque-44 não existe");
  // Fora de qualquer @media: o último @media antes dela já fechou (uma chave sozinha na coluna 0).
  const antes = css.slice(0, i);
  assert.match(antes.slice(antes.lastIndexOf("@media")), /\n\}\n/, "a regra está dentro de um @media");
  const bloco = css.slice(i, i + 420);
  assert.match(bloco, /^\.area-de-toque-44 \{\s*position: relative;\s*\}\s*\.area-de-toque-44::after \{\s*content: "";\s*position: absolute;\s*left: 50%;\s*top: 50%;\s*width: max\(100%, 44px\);\s*height: max\(100%, 44px\);\s*transform: translate\(-50%, -50%\);\s*\}/);
  // Sem desenho: nada de cor, borda ou sombra no pseudo-elemento.
  assert.doesNotMatch(bloco.slice(0, bloco.indexOf("}", bloco.indexOf("::after")) + 1), /background|border|shadow|outline|opacity/);
});

test(".alvo-toque (tela de toque) garante também 44 px de largura, sem mudar o que já dava", () => {
  const i = css.indexOf("@media (pointer: coarse) {\n  .alvo-toque {");
  assert.ok(i > 0);
  const bloco = css.slice(i, i + 420);
  // Antes: 4 px para cada lado (left/right −4px). Agora: a mesma largura, ou 44 px se o elemento for estreito.
  assert.match(bloco, /\.alvo-toque::after \{\s*content: "";\s*position: absolute;\s*height: 44px;\s*left: 50%;\s*top: 50%;\s*width: max\(calc\(100% \+ 8px\), 44px\);\s*transform: translate\(-50%, -50%\);\s*\}/);
});

test(".alvo-toque dá 44 px de altura em tela de toque", () => {
  assert.match(css, /@media \(pointer: coarse\)\s*\{\s*\.alvo-toque \{[\s\S]*?\.alvo-toque::after \{[\s\S]*?height: 44px;/);
});
