/*
  E828 — o nome do nível é o mesmo no cartão, na página do anúncio e na home: uma pílula só (Essencial · Conforto ·
  Premium, cada um na sua cor), lida como "Nível X"; "Pronto para Morar" é outro selo e não fica sobre a foto.
  Roda: node --test src/lib/e828-nome-nivel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NIVEIS, ROTULO_NIVEL } from "../config/niveis.ts";
import { tituloNivel } from "./niveis/exibicao.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const pilula = ler("../components/niveis/pilula-nivel.tsx");
const cartao = ler("../components/property/selos-foto.tsx");
const secao = ler("../components/niveis/nivel-imovel.tsx");
const home = ler("../app/(public)/page.tsx");
const pagina = ler("../app/(public)/imoveis/[id]/property-detail.tsx");

test("a palavra do nível é uma só e o nome acessível é 'Nível X'", () => {
  assert.deepEqual(NIVEIS.map((n) => ROTULO_NIVEL[n]), ["Essencial", "Conforto", "Premium"]);
  for (const n of NIVEIS) assert.equal(tituloNivel(n), `Nível ${ROTULO_NIVEL[n]}`);
  assert.match(pilula, /export function PilulaNivel/);
  assert.match(pilula, /export const COR_NIVEL/);
  assert.match(pilula, /aria-label=\{nome\}/);
  assert.match(pilula, /\{ROTULO_NIVEL\[nivel\]\}/);
});

test("cartão, seção do nível na página e folha 'Como funcionam' usam a MESMA pílula", () => {
  assert.match(cartao, /<PilulaNivel nivel=\{selos\.nivel\.id\}/);
  assert.doesNotMatch(cartao, /COR_NIVEL/, "a cor não é redefinida no cartão");
  assert.match(secao, /Nível <PilulaNivel nivel=\{dados\.nivel\}/);
  assert.match(secao, /<PilulaNivel nivel=\{n\} testId=\{`nivel-folha-pilula-\$\{n\}`\}/);
});

test("a home explica que Essencial/Conforto/Premium é o NÍVEL, com a mesma pílula", () => {
  const bloco = home.slice(home.indexOf('data-testid="home-niveis"'));
  assert.ok(home.includes('data-testid="home-niveis"'));
  assert.match(bloco, /o <strong className="text-ink">nível<\/strong> do imóvel, numa pílula própria/);
  assert.match(bloco, /NIVEIS\.map\(\(n\) =>[\s\S]*?<PilulaNivel nivel=\{n\}/);
  assert.match(bloco, /CRITERIO_NIVEL\[n\]/);
});

test("'Pronto para Morar' não aparece sobre a foto da página (o cartão também não o mostra)", () => {
  assert.match(pagina, /readyToLive=\{false\}/);
  assert.doesNotMatch(pagina, /readyToLive=\{property\.readyToLiveBadge\}/);
});
