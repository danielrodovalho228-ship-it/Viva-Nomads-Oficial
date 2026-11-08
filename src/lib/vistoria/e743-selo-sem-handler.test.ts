/*
  E743 (L-107, Pista C): com laudo ASSINADO, a tela do dono (/nivel) caía em "Não conseguimos abrir esta tela". Causa: o selo da
  assinatura é componente de SERVIDOR e passava `onFocus` a um <input>; manipulador de evento não atravessa o servidor.
  Correção: sem handler; o clique seleciona o hash por CSS (`select-all`).
  Guarda geral: nenhum componente de servidor de src/components/vistoria passa manipulador de evento (on[A-Z]*) a um elemento.
  Roda: node --test src/lib/vistoria/e743-selo-sem-handler.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../../components/vistoria/", import.meta.url);

test("o selo da assinatura não tem manipulador de evento e seleciona o hash por CSS", () => {
  const s = readFileSync(new URL("selo-assinatura.tsx", dir), "utf8");
  assert.doesNotMatch(s, /\son[A-Z][A-Za-z]*=/);
  assert.match(s, /select-all/);
  assert.match(s, /aria-label="Hash completo da assinatura"/);
  assert.match(s, /data-testid="selo-assinatura"/);
});

test("guarda: componentes de servidor de vistoria (sem 'use client') não passam on* a elementos", () => {
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".tsx") && !n.endsWith(".test.tsx"))) {
    const s = readFileSync(new URL(f, dir), "utf8");
    if (/^\s*["']use client["']/m.test(s)) continue;
    const handlers = s.match(/\son[A-Z][A-Za-z]*=\{/g) ?? [];
    assert.deepEqual(handlers, [], `${f} é componente de servidor e passa manipulador de evento`);
  }
});
