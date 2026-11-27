/*
  Frente 3 (página pública): o t112 caiu com o E718 (ae46d5e9e, 08/11). O bloco "Publicamos para você" reaproveitou a foto
  do passo "Anuncie de graça" (/images/unicas/prop-passo-anuncie.webp) na mesma página — a regra das imagens únicas
  (ordens 19b8abf5 e de7b27fd; t100/t112) proíbe a mesma imagem duas vezes. Nenhuma imagem do acervo sobra para o bloco,
  então ele fica sem foto (texto e botão). Roda: node --test src/lib/frente3-imagens-proprietarios.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pagina = readFileSync("src/app/(public)/para-proprietarios/page.tsx", "utf8");

test("/para-proprietarios não repete nenhuma imagem do acervo na página", () => {
  const srcs = [...pagina.matchAll(/["'](\/images\/[^"']+\.(?:webp|jpe?g|png))["']/g)].map((m) => m[1]);
  const repetidas = srcs.filter((s, i) => srcs.indexOf(s) !== i);
  assert.deepEqual(repetidas, []);
});

test('o bloco "Publicamos para você" segue com o texto e o botão (E718)', () => {
  assert.match(pagina, /Publicamos para você/);
  assert.match(pagina, /data-testid="proprietarios-pedir-ajuda"/);
});
