/* Roda: node --test src/components/ajuda/e455-chat-fecha-fora.test.ts
  E455 (ii), rodada pública 02/11: o painel flutuante "Fale com a Viva" aberto cobria o lado direito do rodapé (textos e
  links) e só saía pelo "Fechar". Agora, aberto, ele fecha ao tocar/clicar fora dele (no conteúdo, no rodapé) e com Esc —
  o conteúdo de baixo volta a ficar livre. (A parte (i), a barra "Comparar", foi o E529 / #2463.)
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync(new URL("./viva-chat.tsx", import.meta.url), "utf8");
const flutuante = s.slice(s.indexOf("export function VivaChatFlutuante"), s.indexOf("if (escondido) return null;"));

test("E455: com o chat aberto, tocar/clicar fora da raiz do flutuante fecha o painel", () => {
  assert.match(flutuante, /if \(!aberto\) return;/);
  assert.match(flutuante, /document\.addEventListener\("pointerdown", aoTocarFora\)/);
  assert.match(flutuante, /!raiz\.current\?\.contains\(e\.target as Node\)\) setAberto\(false\)/);
  assert.match(flutuante, /document\.removeEventListener\("pointerdown", aoTocarFora\)/);
});

test("E455: Esc fecha o painel e devolve o foco ao botão", () => {
  assert.match(flutuante, /e\.key === "Escape"/);
  assert.match(flutuante, /botao\.current\?\.focus\(\)/);
  assert.match(flutuante, /document\.addEventListener\("keydown", aoTeclar\)/);
});
