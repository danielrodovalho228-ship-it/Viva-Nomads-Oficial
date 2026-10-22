/*
  Boas-vindas do app (correção do Daniel, 22/10): a foto aparece inteira, sem véu branco nem gradiente por cima, e a
  logo sai da borda da foto para a área branca, alinhada à margem do texto (24 px). Textos e botões não mudam.
  Roda: node --test src/app/app/boas-vindas/boas-vindas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("foto sem véu: nenhuma faixa branca, translúcida ou gradiente sobre a imagem", () => {
  const foto = src.slice(src.indexOf('data-testid="boas-vindas-foto"'), src.indexOf("</div>", src.indexOf('data-testid="boas-vindas-foto"')));
  assert.doesNotMatch(foto, /bg-white\/|bg-gradient|from-white|absolute inset-x-0 bottom-0/);
  assert.doesNotMatch(src, /-mt-8/, "o texto não sobe por cima da foto");
});

test("logo fora da foto, com a mesma margem do texto", () => {
  const texto = src.slice(src.indexOf('data-testid="boas-vindas-texto"'));
  assert.match(texto.slice(0, 200), /<Logo href="\/app\/boas-vindas" \/>/);
  assert.match(src, /px-6 pt-6/);
});

test("textos e botões de sempre", () => {
  for (const t of [
    "Imóveis mobiliados de 30 a 180 dias, com contrato de verdade.",
    "Para quem vai morar um tempo fora e para quem quer alugar com segurança.",
    "Quero alugar",
    "Quero anunciar",
    "Já tenho conta",
    "Lançamento oficial em 2027.",
  ]) assert.ok(src.includes(t), t);
});
