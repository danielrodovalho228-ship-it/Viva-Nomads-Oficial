/* E782 — a tela de Avaliações segue o padrão das outras telas: seta junto do título, título em tinta, abas sublinhadas, sem título duplicado. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { painelMostraVoltar } from "../../lib/navegacao/voltar-painel.ts";

const f = readFileSync(new URL("./painel.tsx", import.meta.url), "utf8");

// E898 (asserções alteradas): o título e a seta de voltar vêm da casca da Conta (CascaConta ativo="avaliacoes"),
// não mais de um cabeçalho próprio do painel.
const pagina = readFileSync(new URL("../../app/(dashboard)/dashboard/avaliacoes/page.tsx", import.meta.url), "utf8");
const casca = readFileSync(new URL("../account/casca-conta.tsx", import.meta.url), "utf8");

test("voltar é a seta junto do título, a da casca da Conta (não o '← Voltar' em texto do painel)", () => {
  assert.match(pagina, /<CascaConta ativo="avaliacoes">/);
  assert.match(casca, /<VoltarCelular padrao="\/dashboard\/conta"/);
  assert.equal(painelMostraVoltar("/dashboard/avaliacoes"), false);
});

test("título em tinta (o H1 da casca da Conta, não verde grande)", async () => {
  const { TITULO_TELA_CONTA } = await import("../../lib/conta/visual-mockup.ts");
  assert.match(TITULO_TELA_CONTA, /text-ink/);
  assert.doesNotMatch(TITULO_TELA_CONTA, /text-forest/);
  assert.doesNotMatch(f, /<h1/);
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
