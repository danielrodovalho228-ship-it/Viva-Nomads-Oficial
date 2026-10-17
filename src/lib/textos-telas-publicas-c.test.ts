/*
  Textos e acessibilidade de telas públicas (ordem fe07f85d): /precos sem "comissão", /ajuda com rótulo,
  /empresas com name/autocomplete. Roda: node --test src/lib/textos-telas-publicas-c.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEXTO_RENOVACAO_COMISSAO } from "./cobranca/regra.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("/precos: frase da renovação diz 'taxa', não 'comissão'", () => {
  assert.match(TEXTO_RENOVACAO_COMISSAO, /^A taxa é cobrada/);
  assert.doesNotMatch(TEXTO_RENOVACAO_COMISSAO, /comiss/i);
});

test("/ajuda: campo de busca tem aria-label", () => {
  assert.match(ler("../components/ajuda/central-ajuda.tsx"), /aria-label="Buscar nas perguntas frequentes"/);
});

test("/empresas: todos os campos têm name e autocomplete", () => {
  const f = ler("../app/(public)/empresas/empresas-form.tsx");
  const campos = f.match(/<(input|textarea)\b[^>]*>?/g) ?? [];
  assert.ok(campos.length >= 5);
  for (const c of campos.slice(0, 5)) {
    assert.match(c, /\bname="/, c);
    assert.match(c, /\bautoComplete="/, c);
  }
});
