/* E782 — a tela de Avaliações segue o padrão das outras telas: seta junto do título, título em tinta, abas sublinhadas, sem título duplicado. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { painelMostraVoltar } from "../../lib/navegacao/voltar-painel.ts";

const f = readFileSync(new URL("./painel.tsx", import.meta.url), "utf8");

test("voltar é a seta junto do título (não o '← Voltar' em texto do painel)", () => {
  assert.match(f, /<VoltarCelular padrao="\/dashboard"/);
  assert.equal(painelMostraVoltar("/dashboard/avaliacoes"), false);
});

test("título em tinta no tamanho padrão do painel (não verde grande)", () => {
  const h1 = f.slice(f.indexOf("<h1"), f.indexOf("</h1>"));
  assert.match(h1, /text-ink/);
  assert.doesNotMatch(h1, /text-forest/);
});

test("abas sublinhadas como Favoritos, sem pílulas preenchidas", () => {
  const nav = f.slice(f.indexOf('aria-label="Avaliações">'), f.indexOf("{aba === \"para-avaliar\""));
  assert.match(nav, /border-b-2/);
  assert.doesNotMatch(nav, /rounded-full|bg-forest/);
});

test("o título da seção não repete o da aba ativa ('Para avaliar' e 'Feitas' saem do corpo)", () => {
  assert.doesNotMatch(f, /<h2[^>]*>Para avaliar<\/h2>/);
  assert.doesNotMatch(f, /<h2[^>]*>Feitas<\/h2>/);
  assert.match(f, /<h2[^>]*>Recebidas recentes<\/h2>/); // título próprio de outra lista, não duplica
});
