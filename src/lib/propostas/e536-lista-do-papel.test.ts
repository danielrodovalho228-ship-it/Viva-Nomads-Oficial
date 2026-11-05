/*
  E536 — "Ver todos os orçamentos" no detalhe da proposta do MORADOR levava à área do PROPRIETÁRIO
  (/dashboard/orcamentos): o cabeçalho trocava de modo e as mesmas propostas apareciam com os papéis invertidos.
  Correção: o link segue o papel de quem vê — morador vai à lista dele (/dashboard/propostas, "Propostas" no menu do
  morador); dono, a Orçamentos.
  Roda: node --test src/lib/propostas/e536-lista-do-papel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { listaDePropostasDoPapel } from "./lista-do-papel.ts";

test("morador → /dashboard/propostas; dono → /dashboard/orcamentos (nome = destino)", () => {
  assert.deepEqual(listaDePropostasDoPapel("tenant"), { href: "/dashboard/propostas", rotulo: "Ver todas as propostas" });
  assert.deepEqual(listaDePropostasDoPapel("owner"), { href: "/dashboard/orcamentos", rotulo: "Ver todos os orçamentos" });
});

test("o menu do morador chama a lista de 'Propostas' em /dashboard/propostas (o mesmo destino)", () => {
  const menu = readFileSync(new URL("../../config/menu-por-papel.ts", import.meta.url), "utf8");
  assert.match(menu, /rotulo: "Propostas", icone: "orcamentos", href: "\/dashboard\/propostas"/);
});

test("o detalhe da proposta usa o link do papel, não o fixo do dono", () => {
  const detalhe = readFileSync(new URL("../../app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(detalhe, /<Link href="\/dashboard\/orcamentos" className="underline">/);
  assert.match(detalhe, /const lista = listaDePropostasDoPapel\(p\.papel\);/);
  assert.match(detalhe, /<Link href=\{lista\.href\} className="underline" data-testid="proposta-ver-todas">\s*\{lista\.rotulo\}/);
});
