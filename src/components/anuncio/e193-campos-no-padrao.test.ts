/**
 * E193 (reprova do lote 1, 06/11): onde o campo é genuinamente texto, data ou número, ele continua campo, mas com a moldura, o
 * tamanho e o estado do mesmo padrão de cartão grande do assistente (CartaoEscolha: 56 px, borda 2 px, canto 0,75 rem; marcado =
 * verde-claro com borda verde). `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("o campo do assistente tem a moldura do cartão: 56 px, borda 2 px, canto 0,75 rem, estado verde ao preencher/focar", () => {
  const pg = ler("app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  const css = pg.match(/<style>\{`(\.input\{[^`]+)`\}<\/style>/)?.[1] ?? "";
  assert.match(css, /\.input\{[^}]*min-height:3\.5rem/);
  assert.match(css, /\.input\{[^}]*border:2px solid var\(--color-line\)/);
  assert.match(css, /\.input\{[^}]*border-radius:0\.75rem/);
  assert.match(css, /\.input:hover\{border-color:var\(--color-sage\)\}/);
  assert.match(css, /\.input:focus\{border-color:var\(--color-forest\)\}/);
  assert.match(css, /\.input:not\(:placeholder-shown\):not\(:focus\)\{border-color:var\(--color-forest\);background:var\(--color-sage-100\)\}/);
});

test("é a mesma geometria do CartaoEscolha (altura mínima 56 px = min-h-14, borda 2 px, rounded-xl)", () => {
  const c = ler("components/anuncio/escolha-assistente.tsx");
  assert.match(c, /min-h-14 w-full items-center gap-3 rounded-xl border-2/);
  assert.match(c, /on \? "border-forest bg-sage-100" : "border-line hover:border-sage"/);
});

test("os campos próprios dos blocos do assistente (silêncio, pets, limpeza, detalhes, textareas) usam a mesma moldura de cartão", () => {
  for (const f of ["limpeza-estadia-campos", "pets-regras-campos", "detalhes-anuncio-campos", "regras-casa-campos"]) {
    const s = ler(`components/anuncio/${f}.tsx`);
    assert.match(s, /const campo = "w-full min-h-14 rounded-xl border-2 border-line bg-white px-4 text-sm text-ink outline-none transition-colors hover:border-sage focus:border-forest";/, f);
    assert.doesNotMatch(s, /min-h-\[44px\] rounded-lg border border-line/, f);
  }
  assert.match(ler("components/anuncio/chegada-e-pedido-campos.tsx"), /const area = "w-full rounded-xl border-2 border-line/);
  assert.match(ler("components/anuncio/regras-casa-campos.tsx"), /min-h-\[88px\] w-full rounded-xl border-2 border-line/);
});
