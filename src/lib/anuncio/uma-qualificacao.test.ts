/* Roda: node --test src/lib/anuncio/uma-qualificacao.test.ts — E196 (uma "Qualificação" só). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cartao = readFileSync("src/app/(dashboard)/dashboard/imoveis/imoveis-client.tsx", "utf8");
const pagina = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx", "utf8");
const qualificar = readFileSync("src/app/(dashboard)/qualificar/qualificar-client.tsx", "utf8");

test("o botão 'Qualificação' do rascunho abre as 5 telas do assistente daquele rascunho", () => {
  assert.match(cartao, /href=\{`\/dashboard\/imoveis\/novo\?draft=\$\{p\.id\}&qualificacao=1`\}[^>]*>\s*Qualificação\s*</);
  assert.match(pagina, /searchParams\.get\("qualificacao"\) === "1"/);
  assert.match(pagina, /qualDoRascunho && !!draftParam && draftServerId === draftParam/);
});

test("a página /qualificar tem nome próprio: 'Requisitos e selo'", () => {
  assert.match(cartao, /href=\{`\/qualificar\?imovel=\$\{p\.id\}`\}[^>]*>\s*Requisitos e selo\s*</);
  assert.match(qualificar, />Requisitos e selo<\/h1>/);
  assert.doesNotMatch(qualificar, />Qualificação do imóvel<\/h1>/);
});
