/* Roda: node --test src/lib/e416-selos-empilhados.test.ts
  E416 (ordem do Daniel, 05/11): o cartão de anúncio mostra TODOS os selos que o imóvel tem, empilhados em fileira no canto
  superior esquerdo da foto, cada um com ícone + texto — Preço justo, Aceita pets, o nível (Essencial/Conforto/Premium,
  com a medalha Award, a mesma do filtro e da página do imóvel) e Aceita negociação (o "Proprietário verificado", que já
  existia, segue primeiro). Vale para a vitrine (busca pública e todo PropertyCard) e para Meus anúncios. Antes: no máximo
  UM selo sobre a foto e nenhum de nível. Os selinhos dos atalhos da home não mudam.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selosDaFoto } from "./cartao-selos-foto.ts";

const ids = (l: { id: string }[]) => l.map((s) => s.id);

test("E416: com os 4 selos, todos aparecem juntos, na ordem do pedido, cada um com texto", () => {
  const s = selosDaFoto({ precoJusto: true, pets: true, nivel: "conforto", negocia: true });
  assert.deepEqual(ids(s), ["precoJusto", "pets", "nivel", "negocia"]);
  assert.deepEqual(s.map((x) => x.rotulo), ["Preço justo", "Aceita pets", "Conforto", "Aceita negociação"]);
});

test("E416: só com nível, só o selo de nível (com 'vistoriado' quando há laudo)", () => {
  assert.deepEqual(selosDaFoto({ nivel: "premium" }), [{ id: "nivel", rotulo: "Premium" }]);
  assert.deepEqual(selosDaFoto({ nivel: "essencial", nivelVistoriado: true }), [{ id: "nivel", rotulo: "Essencial · vistoriado" }]);
});

test("E416: sem selo nenhum, nada; 'em adequação' não vira selo de nível", () => {
  assert.deepEqual(selosDaFoto({}), []);
  assert.deepEqual(selosDaFoto({ nivel: "em_adequacao" }), []);
  assert.deepEqual(selosDaFoto({ nivel: null, precoJusto: false, pets: false, negocia: false }), []);
});

test("E416: 'Proprietário verificado' (já existia) segue primeiro quando vem com o anúncio", () => {
  assert.deepEqual(ids(selosDaFoto({ verificado: true, pets: true })), ["verificado", "pets"]);
});

const componente = readFileSync(new URL("../components/property/selos-foto.tsx", import.meta.url), "utf8");

test("E416: a fileira fica no canto superior esquerdo, quebra linha e não chega no coração (canto direito)", () => {
  assert.match(componente, /data-testid="selos-foto"/);
  assert.match(componente, /absolute inset-x-3 top-3 @container/);
  // o canto do coração (44 px) fica reservado só na 1ª linha; as de baixo usam a largura toda
  assert.match(componente, /\{!semCoracao && <span aria-hidden className="float-right h-11 w-12"/);
  assert.match(componente, /Award/, "nível com a medalha Award (família Lucide dos demais)");
  assert.match(componente, /BadgePercent/);
  assert.match(componente, /PawPrint/);
  assert.match(componente, /Handshake/);
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
