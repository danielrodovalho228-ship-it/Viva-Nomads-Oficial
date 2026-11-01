/*
  Tela de erro do painel: o "Tentar de novo" chama a função que o Next 16 entrega ao error.tsx (`unstable_retry`, ou
  `reset`). Antes o componente lia uma prop `retry`, que não existe — o botão chamava undefined e quebrava.
  Guarda para TODO error.tsx do app: nenhum lê `retry`.
  Roda: node --test src/lib/painel/tela-de-erro.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("../../../", import.meta.url);
const ler = (p: string) => readFileSync(new URL(p, RAIZ), "utf8");

function errosDoApp(dir = "src/app/", out: string[] = []): string[] {
  for (const nome of readdirSync(new URL(dir, RAIZ))) {
    const p = join(dir, nome);
    if (statSync(new URL(p, RAIZ)).isDirectory()) errosDoApp(`${p}/`, out);
    else if (nome === "error.tsx" || nome === "global-error.tsx") out.push(p);
  }
  return out;
}

test("painel: 'Tentar de novo' chama unstable_retry (ou reset), as props que o Next 16 entrega", () => {
  const tela = ler("src/app/(dashboard)/dashboard/error.tsx");
  assert.match(tela, /^"use client";/);
  assert.match(tela, /export default function ErroDoPainel\(\{ unstable_retry, reset \}/);
  assert.match(tela, /const tentarDeNovo = \(\) => \(unstable_retry \?\? reset\)\?\.\(\);/);
  assert.match(tela, /onClick=\{tentarDeNovo\}/);
  assert.match(tela, /href="\/dashboard"/);
});

test("nenhum error.tsx do app lê a prop `retry` (não existe no Next 16)", () => {
  const telas = errosDoApp();
  assert.ok(telas.length >= 1);
  for (const f of telas) assert.doesNotMatch(ler(f), /\{\s*[^}]*\bretry\b[^}]*\}\s*:\s*\{/, f);
});
