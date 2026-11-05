/* Roda: node --test src/lib/anuncio/e418-e383.test.ts — E418 + E383 (02/11): Meus imóveis sem a caixa de alertas de largura
   total (um link por anúncio), sem cartões repetidos de "Rascunho duplicado" e sem texto no lugar da foto. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gruposRascunhosDuplicados, idsRascunhosDuplicados } from "./rascunhos-duplicados.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("E418 → E508: Meus imóveis sem caixa de alertas — e, desde o E508, sem pendência de tipo de entrada em anúncio publicado", () => {
  const pagina = ler("../../app/(dashboard)/dashboard/imoveis/page.tsx");
  assert.doesNotMatch(pagina, /data-testid="aviso-tipo-entrada"/);
  assert.doesNotMatch(ler("../../app/(dashboard)/dashboard/imoveis/imoveis-client.tsx"), /data-testid="card-tipo-entrada"/);
});

test("E383: grupos de rascunhos repetidos — o 1º é o que aparece", () => {
  const lista = [
    { id: "n", status: "draft", title: "Studio", city: "Uberlândia", neighborhood: "Centro", bedrooms: 1 },
    { id: "x", status: "draft", title: "Outro", city: "Uberlândia", neighborhood: "Centro", bedrooms: 1 },
    { id: "a", status: "draft", title: "studio ", city: "Uberlandia", neighborhood: "centro", bedrooms: 1 },
    { id: "z", status: "draft", title: "Studio", city: "Uberlândia", neighborhood: "Centro", bedrooms: 1 },
  ];
  assert.deepEqual(gruposRascunhosDuplicados(lista), [["n", "a", "z"]]);
  assert.deepEqual([...idsRascunhosDuplicados(lista)].sort(), ["a", "n", "z"]);
  const c = ler("../../app/(dashboard)/dashboard/imoveis/imoveis-client.tsx");
  // E511: a lista passa pela barra (abas, busca, ordem, página) — que parte de `visiveis` (as cópias seguem escondidas).
  assert.match(c, /filtrarEOrdenar\(visiveis, \{ aba, busca, ordem \}\)/);
  assert.match(c, /\{pagina\.visiveis\.map\(\(p\) => \{/);
  assert.match(c, /data-testid="rascunho-copias"/);
  assert.match(c, /\{copias\.has\(p\.id\) && duplicados\.has\(p\.id\) && \(/);
});

test("E383: rascunho sem foto mostra só o ícone (sem label)", () => {
  const c = ler("../../app/(dashboard)/dashboard/imoveis/imoveis-client.tsx");
  assert.match(c, /<PhotoPlaceholder className="aspect-\[4\/3\] w-full shrink-0 rounded-xl sm:w-48 sm:self-start" \/>/);
  assert.doesNotMatch(c, /<PhotoPlaceholder\s+label=\{p\.photos\[0\]\}/);
});
