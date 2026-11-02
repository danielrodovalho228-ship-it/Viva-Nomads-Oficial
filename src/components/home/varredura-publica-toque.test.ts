/*
  Varredura pública 02/11 (Pista A), achados de área de toque a 390 px:
  1. Home: o campo "Para onde você vai?" tinha 24 px de altura dentro da barra de 48 px — tocar acima ou abaixo da linha
     do texto não focava o campo. Agora o campo ocupa a barra inteira (h-12).
  2. /como-funciona: as pílulas da sub-navegação tinham 38 px. Agora têm área de toque de 44 px (.alvo-toque), sem mudar
     o desenho.
  Roda: node --test src/components/home/varredura-publica-toque.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("home: o campo de busca ocupa a altura inteira da barra (48 px)", () => {
  const src = ler("src/components/home/busca-principal.tsx");
  assert.match(src, /pillClassName="flex h-12 items-center"/);
  assert.match(src, /inputClassName="foco-na-barra h-12 w-full bg-transparent text-base/);
  // O foco aparece na barra inteira (não um retângulo dentro da pílula) — e só quando o CAMPO tem o foco.
  assert.match(src, /has-\[input:focus-visible\]:outline-2/);
  assert.match(ler("src/app/globals.css"), /input\.foco-na-barra:focus-visible \{\n  outline: none;\n\}/);
});

test("/como-funciona: pílulas da sub-navegação com área de toque de 44 px", () => {
  const src = ler("src/app/(public)/como-funciona/page.tsx");
  const nav = src.slice(src.indexOf("function SubNav"), src.indexOf("function Steps"));
  assert.match(nav, /className="alvo-toque whitespace-nowrap rounded-full/);
  // O contêiner tem py-3 (12 px): o alvo de 44 px cabe sem ser cortado pela rolagem lateral.
  assert.match(nav, /overflow-x-auto py-3/);
});
