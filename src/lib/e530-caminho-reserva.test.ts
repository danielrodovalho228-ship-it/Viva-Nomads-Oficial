/*
  E530 — "Ver o caminho de reserva" (anúncio de exemplo) não mostrava caminho nenhum: o link só rolava até o cartão de
  preço (#cartao-preco), ao lado de onde a pessoa já estava. NOME ≠ DESTINO.
  Correção: o mesmo texto vira um "abrir/fechar" que mostra ali mesmo os passos do morador (a MESMA fonte da página
  Como funciona) e leva, se a pessoa quiser, ao passo a passo completo em /como-funciona#para-inquilinos.
  Roda: node --test src/lib/e530-caminho-reserva.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PASSOS_MORADOR } from "../config/caminho-reserva.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const calendario = ler("src/components/property/availability-calendar.tsx");
const comoFunciona = ler("src/app/(public)/como-funciona/page.tsx");

test("os passos do morador: Busque, Converse, Candidate-se, Assine — cada um com texto", () => {
  assert.deepEqual(PASSOS_MORADOR.map((p) => p.titulo), ["Busque", "Converse", "Candidate-se", "Assine"]);
  for (const p of PASSOS_MORADOR) assert.ok(p.texto.length > 20, p.titulo);
});

test("a página Como funciona usa a MESMA fonte dos passos (sem cópia que desatualiza)", () => {
  assert.match(comoFunciona, /import \{ PASSOS_MORADOR \} from "@\/config\/caminho-reserva";/);
  assert.match(comoFunciona, /PASSOS_MORADOR\[0\]/);
  assert.doesNotMatch(comoFunciona, /title: "Candidate-se", text: "Envie sua candidatura/);
});

test("o link deixa de rolar para o cartão de preço: abre o caminho ali mesmo e oferece o passo a passo", () => {
  assert.doesNotMatch(calendario, /href="#cartao-preco"/);
  const bloco = calendario.slice(calendario.indexOf('data-testid="caminho-reserva"'), calendario.indexOf("</details>", calendario.indexOf('data-testid="caminho-reserva"')));
  assert.match(calendario, /<details[^>]*data-testid="caminho-reserva"/);
  assert.match(bloco, /<summary[^>]*>\s*Ver o caminho de reserva\s*<\/summary>/);
  assert.match(bloco, /PASSOS_MORADOR\.map/);
  assert.match(bloco, /href="\/como-funciona#para-inquilinos"/);
});
