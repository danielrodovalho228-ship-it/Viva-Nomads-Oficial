/* Roda: node --test src/lib/e626-selos-cartao.test.ts
  E626 (estudo de selos aprovado pelo Daniel, 06/11; substitui o E416): o cartão mostra no MÁXIMO 2 pílulas sobre a foto.
  Pílula 1 = o nível em palavra, na cor do nível (Essencial branco com borda #b8b8b8, Conforto verde-marca, Premium
  preto-marca), sem "· vistoriado". Pílula 2 = branca, só símbolos, nesta ordem: verificado, preço justo, pets,
  negociação — cada um com aria-label e title com o texto completo; some se não houver nenhum. O preço justo trocou o
  BadgePercent por uma etiqueta com visto. A página do imóvel traz a lista completa (símbolo + texto).
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pilulasDoCartao, selosDaFoto } from "./cartao-selos-foto.ts";

const ids = (l: { id: string }[]) => l.map((s) => s.id);
const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("E626: 0 selos — nenhuma pílula; 'em adequação' e nível nulo não viram pílula de nível", () => {
  for (const s of [selosDaFoto({}), selosDaFoto({ nivel: "em_adequacao" }), selosDaFoto({ nivel: null, precoJusto: false, pets: false, negocia: false })]) {
    assert.equal(s.nivel, null);
    assert.deepEqual(s.simbolos, []);
    assert.equal(pilulasDoCartao(s), 0);
  }
});

test("E626: só o nível — 1 pílula, em palavra e sem '· vistoriado' (mesmo com laudo)", () => {
  const a = selosDaFoto({ nivel: "premium" });
  assert.deepEqual(a.nivel, { id: "premium", rotulo: "Premium" });
  assert.equal(pilulasDoCartao(a), 1);
  assert.equal(selosDaFoto({ nivel: "essencial", nivelVistoriado: true }).nivel?.rotulo, "Essencial");
});

test("E626: só símbolos — 1 pílula, sem a do nível", () => {
  const s = selosDaFoto({ pets: true });
  assert.equal(s.nivel, null);
  assert.deepEqual(s.simbolos, [{ id: "pets", rotulo: "Aceita pets" }]);
  assert.equal(pilulasDoCartao(s), 1);
});

test("E626: 5 selos — no máximo 2 pílulas; os 4 símbolos na ordem verificado, preço justo, pets, negociação", () => {
  const s = selosDaFoto({ verificado: true, precoJusto: true, pets: true, nivel: "conforto", negocia: true });
  assert.equal(s.nivel?.id, "conforto");
  assert.deepEqual(ids(s.simbolos), ["verificado", "precoJusto", "pets", "negocia"]);
  assert.deepEqual(s.simbolos.map((x) => x.rotulo), ["Proprietário verificado", "Preço justo", "Aceita pets", "Aceita negociação"]);
  assert.equal(pilulasDoCartao(s), 2);
});

test("E626: a ordem dos símbolos não depende da ordem em que os dados chegam", () => {
  assert.deepEqual(ids(selosDaFoto({ negocia: true, pets: true, verificado: true }).simbolos), ["verificado", "pets", "negocia"]);
});

const componente = ler("../components/property/selos-foto.tsx");

test("E626: pílula do nível com a cor de cada nível; símbolos com aria-label e title (leitor de tela lê os 4 nomes)", () => {
  assert.match(componente, /essencial: "border-\[#b8b8b8\] bg-white text-ink"/);
  assert.match(componente, /conforto: "border-transparent bg-forest text-white"/);
  assert.match(componente, /premium: "border-transparent bg-night text-white"/);
  assert.match(componente, /role="img" aria-label=\{s\.rotulo\} title=\{s\.rotulo\}/);
  assert.match(componente, /role="group" aria-label="Selos do anúncio"/);
  assert.doesNotMatch(componente, /vistoriado/);
});

test("E626: o coração segue com o canto (espaçador flutuante) e o selo de preço justo é a etiqueta com visto", () => {
  assert.match(componente, /absolute inset-x-3 top-3 @container/);
  assert.match(componente, /\{!semCoracao && <span aria-hidden className="float-right h-11 w-12"/);
  assert.match(componente, /precoJusto: IconePrecoJusto/);
  assert.doesNotMatch(componente, /BadgePercent/);
  const icone = ler("../components/ui/icone-preco-justo.tsx");
  assert.match(icone, /<Tag /);
  assert.match(icone, /<Check /);
  for (const f of ["../components/ui/badge.tsx", "../components/precos/comparacao-airbnb-ficha.tsx"]) assert.doesNotMatch(ler(f), /BadgePercent/, f);
});

test("E626: a página do imóvel tem a lista completa (símbolo + texto) e a folha dos níveis corrigida", () => {
  const lista = ler("../components/property/selos-anuncio.tsx");
  assert.match(lista, /ROTULO_SIMBOLO\[id\]/);
  assert.match(ler("../app/(public)/imoveis/[id]/property-detail.tsx"), /<SelosAnuncio tem=\{simbolosDoImovel\(property\)\} \/>/);
  const folha = ler("../components/niveis/nivel-imovel.tsx");
  assert.match(folha, /O nível não muda a ordem da busca\./);
  assert.doesNotMatch(folha, /Nível não é selo/);
});

test("E416: a vitrine (PropertyCard) e Meus anúncios usam a mesma fileira", () => {
  const cartao = readFileSync(new URL("../components/property-card.tsx", import.meta.url), "utf8");
  const meus = readFileSync(new URL("../app/(dashboard)/dashboard/imoveis/imoveis-client.tsx", import.meta.url), "utf8");
  for (const [nome, src] of [["cartão", cartao], ["Meus anúncios", meus]] as const) {
    assert.match(src, /<SelosFoto\b/, nome);
    assert.match(src, /selosDaFoto\(/, nome);
  }
  // O nível e o "Aceita negociação" saem do texto do cartão (viraram selo): nada repetido.
  assert.doesNotMatch(cartao, /seloDoCartao\(/);
  assert.match(cartao, /\.filter\(\(i\) => i\.chave !== "nivel"\)/);
});

test("E416: a página pública do proprietário lê a negociação (o selo aparece também ali)", () => {
  const dados = readFileSync(new URL("./data/properties.ts", import.meta.url), "utf8");
  const fn = dados.slice(dados.indexOf("export async function listPropertiesDoProprietario"), dados.indexOf("export async function listPropertiesDoProprietario") + 2500);
  assert.match(fn, /attachNivel\(supabase, mapped\);[\s\S]{0,160}attachNegociacao\(supabase, mapped\);/);
});

test("E416: Meus anúncios lê também o Preço justo e a negociação (antes só o nível)", () => {
  const dados = readFileSync(new URL("./data/properties.ts", import.meta.url), "utf8");
  const fn = dados.slice(dados.indexOf("export async function listMyProperties"), dados.indexOf("export async function listMyProperties") + 2500);
  assert.match(fn, /attachNivel\(supabase, lista\)/);
  assert.match(fn, /attachPrecoJusto\(supabase, lista\)/);
  assert.match(fn, /attachNegociacao\(supabase, lista\)/);
});
