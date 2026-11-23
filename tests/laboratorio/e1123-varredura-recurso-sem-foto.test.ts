/*
  E1123 (ORDEM-DUET-532 §1): a varredura (fixture varredura-pagina.ts, classe "foto") marcava "área de foto vazia" sobre o
  bloco 16/10 da página pública do avaliador SEM foto — o recurso desenhado da conta sem foto (ORDEM-386: as iniciais no
  círculo, nunca espaço vazio). Medido na main limpa 9813e4109 (lab-critico 45095306834, t1435). A correção é na
  ferramenta de prova: o bloco do recurso, marcado com data-recurso-sem-foto e COM texto (as iniciais), conta como
  conteúdo. Sem enfraquecer o resto: imagem partida e caixa vazia continuam a ser achado.
  Roda: node --test tests/laboratorio/e1123-varredura-recurso-sem-foto.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fixture = readFileSync("tests/e2e/fixtures/varredura-pagina.ts", "utf8");
const pagina = readFileSync("src/app/(public)/avaliadores/[numero]/page.tsx", "utf8");
const blocoFoto = fixture.slice(fixture.indexOf("// FOTO:"), fixture.indexOf("// TEXTO:"));

test("E1123: a fixture conta o recurso da conta sem foto como conteúdo — só com texto dentro (esvaziado, volta a ser achado)", () => {
  assert.match(
    blocoFoto,
    /Array\.from\(el\.querySelectorAll\("\[data-recurso-sem-foto\]"\)\)\.some\(\(n\) => \(n\.textContent \?\? ""\)\.trim\(\)\.length > 0\)/,
  );
});

test("E1123: a detecção de imagem partida e de caixa vazia não muda", () => {
  // As três vias de "tem mídia" de antes ficam iguais: imagem carregada (ou fictícia do lab), vídeo/canvas/iframe/svg, fundo.
  assert.match(blocoFoto, /Array\.from\(el\.querySelectorAll\("img"\)\)\.some\(\(i\) => \(i\.complete && i\.naturalWidth > 0\) \|\| reIgnorar\.test\(i\.currentSrc \|\| i\.src\)\)/);
  assert.match(blocoFoto, /!!el\.querySelector\("video, canvas, iframe, svg"\)/);
  assert.match(blocoFoto, /getComputedStyle\(n\)\.backgroundImage !== "none"/);
  assert.match(blocoFoto, /if \(!temMidia\) foto\.push\(`área de foto vazia \(aspect-ratio \$\{cs\.aspectRatio\}\): \$\{desc\(el\)\}`\);/);
  // E a classe "imagem" (carregamento real) não foi tocada por este item.
  assert.doesNotMatch(fixture.slice(0, fixture.indexOf("// FOTO:")), /data-recurso-sem-foto/);
});

test("E1123: as duas faixas de iniciais da página pública do avaliador levam a marca do recurso", () => {
  const spans = pagina.match(/<span[^>]*data-testid="avaliador-iniciais"[^>]*>/g) ?? [];
  assert.equal(spans.length, 2, "credenciado e sócio");
  for (const s of spans) assert.match(s, /data-recurso-sem-foto=""/, s);
});
