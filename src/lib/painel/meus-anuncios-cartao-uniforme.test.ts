/* Conformidade (cartões uniformes, 31/10): em Meus anúncios, todo cartão tem a foto 4:3 sem esticar e os botões no
   mesmo lugar, com ou sem a linha da estadia mínima. Roda: node --test src/lib/painel/meus-anuncios-cartao-uniforme.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const c = readFileSync("src/app/(dashboard)/dashboard/imoveis/imoveis-client.tsx", "utf8");

test("a foto do cartão não estica com a altura do cartão (sm:self-start, com e sem foto)", () => {
  assert.match(c, /className="aspect-\[4\/3\] w-full shrink-0 sm:w-48 sm:self-start"/);
  assert.match(c, /className="aspect-\[4\/3\] w-full shrink-0 rounded-xl sm:w-48 sm:self-start"/);
});

test("o preço ocupa o espaço que sobra e quebra a linha; os botões não descem só num cartão", () => {
  assert.match(c, /data-testid="anuncio-rodape">\s*<div className="min-w-0 flex-1 basis-56">/);
});
