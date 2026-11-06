/*
  E630 (rodada 10, 05/11): num rascunho novo sem título, a Revisão aponta título e descrição como pendentes (E613), mas a PRÉVIA do editor
  mostrava "Apartamento no Saraiva" como se fosse o título — o mascaramento que o E613 tirou da Revisão continuava na prévia.
  Agora a prévia (lateral) e o cartão da Revisão mostram o campo vazio como pendente.
  Roda: node --test src/lib/anuncio/e630-previa-titulo-pendente.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tituloDaPrevia } from "./assistente-telas.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const PREVIA = ler("src/app/(dashboard)/dashboard/imoveis/novo/previa-anuncio.tsx");
const REVISAR = ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx");

test("E630: sem título o cartão não inventa um (nem 'Apartamento no <bairro>', nem 'Seu imóvel')", () => {
  const r = tituloDaPrevia("");
  assert.equal(r.pendente, true);
  assert.doesNotMatch(r.texto, /Apartamento no|Seu imóvel|Quarto privativo/);
});

test("E630: a prévia lateral e o cartão da Revisão leem a MESMA regra e marcam o pendente", () => {
  for (const [nome, f, tid] of [["prévia", PREVIA, "previa-titulo"], ["revisão", REVISAR, "revisao-titulo"]] as const) {
    assert.match(f, /tituloDaPrevia\(p\.titulo\)/, nome);
    assert.doesNotMatch(f, /tituloPrevia\(/, nome); // a função que inventava o título saiu
    assert.match(f, new RegExp(`data-testid="${tid}-pendente"`), nome);
    assert.match(f, /titulo\.pendente \?/, nome);
  }
});

test("E630: o <p> do título segue com a mesma estrutura (guarda do E242: logo depois do 'tamanho real')", () => {
  assert.match(PREVIA, /<\/div>\n\s*\{p\.tamanhoReal\}\n\s*<p className="mt-4 font-title[^"]*" data-testid="previa-titulo">/);
  assert.match(REVISAR, /<\/div>\n\s*\{p\.tamanhoReal\}\n\s*<p className="mt-4 font-title[^"]*" data-testid="revisao-titulo">/);
});

test("E630: nenhum outro lugar do assistente chama a função antiga", () => {
  assert.doesNotMatch(ler("src/lib/anuncio/assistente-telas.ts"), /export function tituloPrevia\b/);
});
