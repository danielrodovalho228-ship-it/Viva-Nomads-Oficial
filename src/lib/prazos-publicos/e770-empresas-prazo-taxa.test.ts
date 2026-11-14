import { test } from "node:test";
import assert from "node:assert/strict";
import { fonte } from "./ler.ts";

/* E770 🔴: /empresas passa a informar, no bloco "Fale com a gente", o prazo do canal empresas (fonte única) e a taxa
   (a regra das superfícies comerciais: a taxa é do proprietário, quem vem morar não paga — sem valores inventados). */
const pagina = fonte("src/app/(public)/empresas/page.tsx");
const bloco = pagina.slice(pagina.indexOf('id="fale-com-a-gente"'));

test("o bloco 'Fale com a gente' de /empresas mostra o prazo do canal empresas pela fonte única", () => {
  assert.match(pagina, /from "@\/config\/prazos-canais"/);
  assert.match(bloco, /data-testid="empresas-prazo-resposta"[^>]*>\s*\{TEXTO_PRAZO_EMPRESAS\}/);
});

test("o bloco mostra a taxa (do proprietário; quem vem morar não paga) e os passos/FAQ usam a mesma fonte", () => {
  assert.match(bloco, /data-testid="empresas-taxa"/);
  assert.match(pagina, /TAXA_EMPRESAS/);
  assert.match(pagina, /\$\{PRAZO_CANAL\.empresas\.texto\}|\$\{TEXTO_PRAZO_EMPRESAS\}/);
});
