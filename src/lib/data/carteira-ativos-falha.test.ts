/*
  Auditoria de erros e estados vazios (rodada 5, 2º achado) — /dashboard/carteira contava os imóveis ativos com
  `imoveisAtivosDoDono()`, que devolvia 0 na falha do banco. A tela então dizia "Abre com 3 imóveis ativos — Você tem 0
  imóveis ativos. Com mais 3…" a quem tem a carteira aberta. Agora a tela pede com `exigir`: a falha lança e o painel
  mostra "Não conseguimos abrir esta tela" com "Tentar de novo". Os contadores do menu seguem sem `exigir` (falha = 0,
  sem derrubar a casca).
  Roda: node --test src/lib/data/carteira-ativos-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("imoveisAtivosDoDono lança na falha do banco quando pedida com exigir", () => {
  const src = ler("src/lib/data/menu-actions.ts");
  const bloco = src.slice(src.indexOf("export async function imoveisAtivosDoDono"));
  assert.match(bloco, /^export async function imoveisAtivosDoDono\(opcoes: \{ exigir\?: boolean \} = \{\}\): Promise<number>/);
  assert.match(bloco, /if \(error && opcoes\.exigir\) throw new Error\(MSG_ATIVOS_NAO_CARREGARAM\);/);
});

test("a Carteira pede com exigir; os contadores do menu não", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/carteira/page.tsx"), /await imoveisAtivosDoDono\(\{ exigir: true \}\)/);
  assert.match(ler("src/lib/painel/contadores-servidor.ts"), /imoveisAtivosDoDono\(\)\.catch\(\(\) => 0\)/);
});
