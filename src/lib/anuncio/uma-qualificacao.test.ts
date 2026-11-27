/* Roda: node --test src/lib/anuncio/uma-qualificacao.test.ts — E196 (uma "Qualificação" só). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cartao = readFileSync("src/app/(dashboard)/dashboard/imoveis/imoveis-client.tsx", "utf8");
const pagina = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx", "utf8");
const rotaQualificar = readFileSync("src/app/(dashboard)/qualificar/page.tsx", "utf8");

test("o botão 'Qualificação' do rascunho abre as 5 telas do assistente daquele rascunho", () => {
  assert.match(cartao, /href=\{`\/dashboard\/imoveis\/novo\?draft=\$\{p\.id\}&qualificacao=1`\}[^>]*>\s*Qualificação\s*</);
  assert.match(pagina, /searchParams\.get\("qualificacao"\) === "1"/);
  assert.match(pagina, /qualDoRascunho && !!draftParam && draftServerId === draftParam/);
});

test("E196 (fecho): um caminho só — o cartão não tem outro botão e /qualificar só redireciona ao assistente", () => {
  assert.doesNotMatch(cartao, /\/qualificar\?imovel=/);
  assert.doesNotMatch(cartao, /Requisitos e selo/);
  assert.equal((cartao.match(/>\s*Qualificação\s*</g) ?? []).length, 1);
  // A rota antiga não desenha página nenhuma: sem imóvel, o cadastro novo; com imóvel, a Revisão (ou o editor).
  assert.doesNotMatch(rotaQualificar, /QualificarClient|<[A-Z]/);
  assert.match(rotaQualificar, /if \(!id\) redirect\(destinoQualificarSemImovel\(\)\);/);
  assert.match(rotaQualificar, /redirect\(destinoDaQualificacao\(await resumoImovelDoDono\(id\)\)\);/);
});
