/*
  E242 (guarda permanente): no cadastro, entre o selo ("Anunciar imóvel" / "Editar anúncio", com o estado do salvamento
  na mesma linha) e o título do passo só pode existir o próprio título — nenhum link, botão ou bloco no meio. O
  "Ver no tamanho real" mora no cartão da prévia, embaixo da foto (computador), e no fim do passo (celular).
  Roda: node --test src/lib/anuncio/e242-selo-titulo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");
const NOVO = ler("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx");
const PREVIA = ler("src/app/(dashboard)/dashboard/imoveis/novo/previa-anuncio.tsx");
const REVISAR = ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx");

/** O trecho do selo até o título: a linha do selo (abre em `cadastro-linha-selo`) e o que vier antes do <h1>. */
const trecho = () => {
  const i = NOVO.indexOf('data-testid="cadastro-linha-selo"');
  const j = NOVO.indexOf('data-testid="passo-titulo"');
  assert.ok(i > 0 && j > i, "selo antes do título");
  // Comentários de JSX não contam (podem citar o que saiu dali).
  return NOVO.slice(i, NOVO.lastIndexOf("<h1", j)).replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
};

test("E242: entre o selo e o título só existe o próprio título", () => {
  const t = trecho();
  // A linha do selo fecha antes do título; depois dela, só comentário e espaço até o <h1>.
  const fim = t.lastIndexOf("</div>");
  const depoisDoSelo = t.slice(fim + "</div>".length).trim();
  assert.equal(depoisDoSelo, "", `algo entre o selo e o título: ${depoisDoSelo.slice(0, 80)}`);
  // Dentro da linha do selo, só o selo e o estado do salvamento (sem link, botão ou bloco).
  const tags = new Set([...t.slice(0, fim).matchAll(/<([A-Za-z][\w.]*)/g)].map((m) => m[1]));
  for (const tag of tags) assert.ok(["span", "Check", "XCircle"].includes(tag), `tag no selo: <${tag}>`);
  assert.doesNotMatch(t, /BotaoTamanhoReal|tamanho real|<button|<Link|<a\b/i);
});

test("E242: 'Ver no tamanho real' no cartão da prévia, embaixo da foto (computador), e no fim do passo (celular)", () => {
  // Cartão lateral e cartão da Revisão: logo depois do bloco da foto, antes do título do cartão.
  assert.match(PREVIA, /<\/div>\n\s*\{p\.tamanhoReal\}\n\s*<p className="mt-4 font-title[^"]*" data-testid="previa-titulo">/);
  assert.match(REVISAR, /<\/div>\n\s*\{p\.tamanhoReal\}\n\s*<p className="mt-4 font-title[^"]*" data-testid="revisao-titulo">/);
  // Celular: um bloco só, depois do conteúdo do passo, escondido no computador.
  assert.equal((NOVO.match(/data-testid="previa-tamanho-real-passo"/g) ?? []).length, 1);
  assert.ok(NOVO.indexOf('data-testid="previa-tamanho-real-passo"') > NOVO.indexOf('data-testid="fotos-reorganizar"'), "no fim do passo");
  assert.ok(NOVO.indexOf('data-testid="previa-tamanho-real-passo"') < NOVO.indexOf('data-testid="novo-resumo"'), "antes da coluna lateral");
});
