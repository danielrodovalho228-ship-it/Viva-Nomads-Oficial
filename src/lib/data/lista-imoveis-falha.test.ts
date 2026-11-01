/*
  Auditoria de erros e estados vazios — achado nº 4: em "Meus imóveis", uma falha do banco virava lista vazia e a tela
  dizia que o dono ainda não tinha imóveis (o que leva a cadastrar o mesmo imóvel de novo). Agora a tela pede a lista
  com `exigir`: a falha lança e o painel mostra "Não conseguimos abrir esta tela" com "Tentar de novo". As outras telas
  que só contam imóveis seguem com a lista vazia na falha (não derrubam o painel).
  Roda: node --test src/lib/data/lista-imoveis-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("listMyProperties: com exigir, a falha do banco lança — nunca vira 'você ainda não tem imóveis'", () => {
  const src = ler("src/lib/data/properties.ts");
  const fn = src.slice(src.indexOf("export async function listMyProperties"), src.indexOf("export async function listMyProperties") + 1200);
  assert.match(fn, /listMyProperties\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(fn, /if \(error && opcoes\.exigir\) throw new Error\(MSG_IMOVEIS_NAO_CARREGARAM\);\n\s*if \(error \|\| !data\) return \[\];/);
});

test("a tela Meus imóveis pede com exigir; o painel tem a tela de erro com 'Tentar de novo'", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/page.tsx"), /listMyProperties\(\{ exigir: true \}\)/);
  const erro = ler("src/app/(dashboard)/dashboard/error.tsx");
  assert.match(erro, /Não conseguimos abrir esta tela/);
  assert.match(erro, /Tentar de novo/);
  // Os contadores e as outras telas não passam exigir (uma falha ali não derruba o painel inteiro).
  for (const f of ["src/app/(dashboard)/dashboard/page.tsx", "src/app/(dashboard)/dashboard/ganhos/page.tsx", "src/app/api/properties/mine/route.ts"]) {
    assert.doesNotMatch(ler(f), /listMyProperties\(\{ exigir: true \}\)/, f);
  }
});
