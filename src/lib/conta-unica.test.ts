/*
  Conta única (ordem a8c05cd0, parte 1): o seletor Inquilino/Proprietário saiu do cabeçalho.
  Roda: node --test src/lib/conta-unica.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("o cabeçalho não tem mais o chip de modo nem a animação de virada de chave", () => {
  assert.equal(existsSync(new URL("../components/layout/modo-chip.tsx", import.meta.url)), false);
  const shell = ler("components/layout/dashboard-shell.tsx");
  assert.doesNotMatch(shell, /ModoChip|modo-chip/);
  assert.doesNotMatch(shell, /Modo: \{/);
  assert.doesNotMatch(ler("app/globals.css"), /modo-chave/);
});

test("abrir 'Anunciar meu imóvel' não troca nem avisa modo", () => {
  const novo = ler("app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  assert.doesNotMatch(novo, /aviso-modo-proprietario|setPreferredMode|modo Proprietário/);
});
