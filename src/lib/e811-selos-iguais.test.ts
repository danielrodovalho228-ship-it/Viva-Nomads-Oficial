/*
  E811 — os mesmos selos no cartão da busca e na página do anúncio, com o critério visível, e pets inequívoco.
  Roda: node --test src/lib/e811-selos-iguais.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_PROPERTIES } from "./properties.ts";
import { CRITERIO_SIMBOLO, ORDEM_SIMBOLOS, selosDaFoto, simbolosDoImovel } from "./cartao-selos-foto.ts";

const ler = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const CARTAO = ler("components/property-card.tsx");
const PAGINA = ler("app/(public)/imoveis/[id]/property-detail.tsx");
const SELOS_PAGINA = ler("components/property/selos-anuncio.tsx");

test("cartão e página chamam a MESMA fonte dos selos", () => {
  assert.match(CARTAO, /selosDaFoto\(\{\s*\.\.\.simbolosDoImovel\(property\)/);
  assert.match(PAGINA, /<SelosAnuncio tem=\{simbolosDoImovel\(property\)\} \/>/);
});

test("a página não acrescenta selos que o cartão não tem (Pronto para Morar na foto, home office, bem localizado)", () => {
  assert.doesNotMatch(PAGINA, /<PropertyTags\b/);
  assert.match(PAGINA, /readyToLive=\{false\}/);
  assert.doesNotMatch(PAGINA, /readyToLive=\{property\.readyToLiveBadge\}/);
});

test("nos 15 exemplos, os selos do cartão = os selos da página (mesma lista, mesma ordem)", () => {
  for (const p of SAMPLE_PROPERTIES) {
    const tem = simbolosDoImovel(p);
    const cartao = selosDaFoto({ ...tem, nivel: p.nivel }).simbolos.map((s) => s.id);
    const pagina = ORDEM_SIMBOLOS.filter((id) => tem[id]); // o que <SelosAnuncio> desenha
    assert.deepEqual(cartao, pagina, p.id);
    assert.equal(tem.verificado, false, `${p.id}: exemplo nunca leva "verificado"`);
  }
});

test("todo selo tem critério visível na página", () => {
  for (const id of ORDEM_SIMBOLOS) assert.ok(CRITERIO_SIMBOLO[id].length > 20, id);
  assert.match(SELOS_PAGINA, /data-testid="selos-criterios"/);
  assert.match(SELOS_PAGINA, /\{CRITERIO_SIMBOLO\[id\]\}/);
});

test("pets inequívoco: 'Aceita pets' na lista ⇒ selo + linha de regra (ube-003 incluído)", () => {
  for (const p of SAMPLE_PROPERTIES) {
    const naLista = (p.amenities ?? []).includes("Aceita pets");
    // Quem diz "Aceita pets" na lista "Tem" tem o dado ligado (e, com ele, o selo e a linha "Animais").
    if (naLista) assert.equal(p.petsAllowed, true, `${p.id}: lista "Tem" diz pets, mas o dado não`);
    if (p.petsAllowed === true) assert.equal(simbolosDoImovel(p).pets, true, `${p.id}: selo`);
  }
  const ube003 = SAMPLE_PROPERTIES.find((p) => p.id === "ube-003")!;
  assert.equal(ube003.petsAllowed, true);
  // A linha "Animais" das regras aparece sempre que petsAllowed está definido (stay-rules.tsx).
  assert.match(ler("components/property/stay-rules.tsx"), /if \(property\.petsAllowed !== undefined\)\s*rows\.push\(\{\s*icon: PawPrint,\s*label: "Animais"/);
});
