/*
  404 dentro do painel: o notFound() das telas com id do morador e do proprietário cai em
  src/app/(dashboard)/dashboard/not-found.tsx (na casca do painel), não na 404 pública de marketing.
  Roda: node --test src/lib/painel/nao-encontrado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const RAIZ = new URL("../../../", import.meta.url);
const ler = (p: string) => readFileSync(new URL(p, RAIZ), "utf8");
const TELA = "src/app/(dashboard)/dashboard/not-found.tsx";

test("o painel tem a própria 404: título que as specs conferem, motivo sem dizer de quem é, volta ao painel", () => {
  assert.ok(existsSync(new URL(TELA, RAIZ)));
  const t = ler(TELA);
  assert.match(t, /<h1[^>]*>Página não encontrada<\/h1>/);
  assert.match(t, /não existe mais ou não é desta conta/);
  assert.match(t, /href="\/dashboard"/);
  assert.match(t, /title: "Página não encontrada", robots: null/);
  // Nada da 404 pública de marketing (vitrine de imóveis, convite para anunciar) dentro do painel.
  assert.doesNotMatch(t, /listProperties|PropertyCard|destaque|Anuncie|para-proprietarios/);
});

test("as telas do painel que chamam notFound() ficam abaixo de /dashboard (cobertas por esta 404)", () => {
  for (const p of [
    "src/app/(dashboard)/dashboard/estadia/[contratoId]/page.tsx",
    "src/app/(dashboard)/dashboard/propostas/[id]/page.tsx",
    "src/app/(dashboard)/dashboard/visitas/[id]/page.tsx",
    "src/app/(dashboard)/dashboard/servicos/pedidos/[id]/page.tsx",
  ]) assert.match(ler(p), /notFound\(\)/, p);
});
