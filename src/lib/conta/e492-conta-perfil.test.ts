/*
  E492 (+E552) — fluxo duplicado "Minha conta" × "Perfil": no computador, /dashboard/conta e /dashboard/conta/perfil
  mostravam a MESMA tela de perfil com dois endereços. Correção: um endereço só — no computador, /dashboard/conta leva a
  /dashboard/conta/perfil (substitui a entrada do histórico); no celular, /dashboard/conta continua sendo o menu da Conta.
  As âncoras antigas (#confianca, #documento…) seguem indo para a sua tela.
  Roda: node --test src/lib/conta/e492-conta-perfil.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { destinoDaContaNoComputador } from "./secoes.ts";

test("puro: no computador a Conta vai para o Perfil; âncora antiga vence", () => {
  assert.equal(destinoDaContaNoComputador(null), "/dashboard/conta/perfil");
  assert.equal(destinoDaContaNoComputador("/dashboard/conta/dados"), "/dashboard/conta/dados");
});

test("a página da Conta não monta mais a tela de Perfil (um endereço só) e troca a URL no computador", () => {
  const p = readFileSync("src/app/(dashboard)/dashboard/conta/page.tsx", "utf8");
  assert.doesNotMatch(p, /<PerfilTela \/>/);
  assert.match(p, /window\.location\.replace\(destinoDaContaNoComputador\(/);
  assert.match(p, /<ContaMenu \/>/, "o celular continua com o menu");
});
