/* Roda: node --test src/lib/anuncio/excluir-rascunho.test.ts — E515: a confirmação de excluir nomeia o rascunho. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avisoExcluirRascunho, nomeDoRascunho, rotuloExcluirRascunho } from "./excluir-rascunho.ts";

test("o aviso diz qual rascunho será apagado (título e bairro)", () => {
  assert.equal(avisoExcluirRascunho("Apartamento claro", "Santa Mônica"), "Excluir o rascunho “Apartamento claro” (Santa Mônica)? Esta ação não pode ser desfeita.");
  assert.equal(rotuloExcluirRascunho("Apartamento claro", "Santa Mônica"), "Excluir o rascunho “Apartamento claro” (Santa Mônica)");
});

test("sem repetir o bairro que já está no título; sem título, diz que é sem título", () => {
  assert.equal(nomeDoRascunho("Casa no Santa Mônica", "Santa Mônica"), "“Casa no Santa Mônica”");
  assert.equal(nomeDoRascunho("  ", "Centro"), "sem título (Centro)");
  assert.equal(nomeDoRascunho(null, null), "sem título");
});

test("Meus imóveis usa o aviso e o rótulo com o rascunho de cada cartão (não mais o texto genérico)", () => {
  const s = readFileSync("src/app/(dashboard)/dashboard/imoveis/imoveis-client.tsx", "utf8");
  assert.match(s, /aviso=\{avisoExcluirRascunho\(p\.title, p\.neighborhood\)\}/);
  assert.match(s, /ariaLabel=\{rotuloExcluirRascunho\(p\.title, p\.neighborhood\)\}/);
  assert.doesNotMatch(s, /Excluir este rascunho\?/);
});
