/*
  Frente 3 (busca): o t70 caiu com o C1b (43836b8f1, 08/11). A faixa do "Fale com a Viva" (padding-right do
  .container-page público) passou a valer também no contêiner da /buscar, que usa lg:px-0 de propósito — e a /buscar
  não mostrava o botão (ESCONDER, E95 — até o E931). Resultado: 40 px a mais à direita; o mapa saiu da margem de 24 px (E659) e a lista
  caiu para 52,8% (t70 pede ≥ 53%). O contêiner da busca fica fora da faixa; o resto do site público segue com ela (C1b).
  Roda: node --test "src/app/(public)/buscar/frente3-faixa-flutuante.test.ts"
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("src/app/globals.css", "utf8");
const chat = readFileSync("src/components/ajuda/viva-chat.tsx", "utf8");
const busca = readFileSync("src/app/(public)/buscar/search-client.tsx", "utf8");

// E931 (asserção alterada): a /buscar voltou a ter o "Fale com a Viva" (o E95 acabou com o E246: no celular o botão some).
// O contêiner da busca continua SEM a faixa do C1b: o botão flutua sobre o canto do mapa, não sobre a lista, e o layout do
// E659/t70 (mapa a 24 px da margem, lista ≥ 53%) fica como está.
test("E931: a /buscar mostra o Fale com a Viva e o contêiner continua fora da faixa (o botão flutua sobre o mapa)", () => {
  assert.doesNotMatch(chat.split("\n").find((l) => l.includes("export const ESCONDER")) ?? "", /"\/buscar"/);
});

test("o contêiner da busca se marca como sem faixa e a regra do C1b o deixa de fora (768 e 1024 px)", () => {
  assert.match(busca, /data-sem-faixa-flutuante[\s\S]{0,40}className="container-page mt-4 lg:flex|className="container-page mt-4 lg:flex[^"]*"[\s\S]{0,80}data-sem-faixa-flutuante/);
  const regras = [...css.matchAll(/html:not\(\[data-app\]\) \.vn-main \.container-page[^{]*\{\s*padding-right: max\(/g)].map((m) => m[0]);
  assert.equal(regras.length, 2, "as duas regras do C1b (768 e 1024 px)");
  for (const r of regras) assert.match(r, /\.container-page:not\(\[data-sem-faixa-flutuante\]\)/);
});
