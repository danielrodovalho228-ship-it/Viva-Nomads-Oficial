/*
  t204 a 390 px (lab do #2777): o rascunho da URL chegou depois do envio das fotos e a lista foi trocada inteira — 7
  fotos viraram 1 e a IA das fotos ficou "parada". Aplicar o rascunho agora mescla.
  Roda: node --test src/lib/anuncio/fotos-do-rascunho.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mesclarFotosDoRascunho } from "./fotos-do-rascunho.ts";

const f = (id: string, url = `https://x/${id}.webp`) => ({ id, url });

test("fotos adicionadas enquanto o rascunho carregava não somem quando ele chega", () => {
  const r = mesclarFotosDoRascunho([f("r1")], [f("a"), f("b"), f("c")], new Set());
  assert.deepEqual(r.map((x) => x.id), ["r1", "a", "b", "c"]);
});

test("sem duplicar (mesmo id ou mesma url) e sem trazer fotos que já estavam na tela antes (outro rascunho)", () => {
  const r = mesclarFotosDoRascunho([f("r1"), f("r2")], [f("r1"), f("x", "https://x/r2.webp"), f("velha"), f("nova")], new Set(["velha"]));
  assert.deepEqual(r.map((x) => x.id), ["r1", "r2", "nova"]);
  assert.deepEqual(mesclarFotosDoRascunho([f("r1")], [], new Set()).map((x) => x.id), ["r1"]);
});

test("o assistente aplica o rascunho mesclando as fotos (não troca a lista inteira)", () => {
  const p = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");
  assert.match(p, /setPhotos\(\(tela\) => mesclarFotosDoRascunho\(d\.photos as PhotoItem\[\], tela, fotosAntesDoRascunhoRef\.current\)\)/);
  assert.doesNotMatch(p, /if \(Array\.isArray\(d\.photos\)\) setPhotos\(d\.photos as PhotoItem\[\]\);/);
  assert.match(p, /fotosAntesDoRascunhoRef\.current = new Set\(photosRef\.current\.map\(\(x\) => x\.id\)\)/);
});
