/*
  Formulários públicos com name/autocomplete (ordem fe07f85d, continuação do item 4 em /empresas):
  chamado da /ajuda, chat da Viva, pedido de fotógrafo e cadastro de parceiro.
  Roda: node --test src/lib/formularios-publicos-autocomplete.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const tag = (src: string, trecho: string) => {
  const i = src.indexOf(trecho);
  assert.ok(i >= 0, `não achei: ${trecho}`);
  return src.slice(src.lastIndexOf("<", i), src.indexOf("/>", i) + 2);
};

test("/ajuda: nome e e-mail do chamado têm name e autocomplete", () => {
  const f = ler("../components/ajuda/central-ajuda.tsx");
  const nome = tag(f, "setNome(e.target.value)");
  const email = tag(f, "setEmail(e.target.value)");
  assert.match(nome, /\bname="nome"/);
  assert.match(nome, /autoComplete="name"/);
  assert.match(email, /\bname="email"/);
  assert.match(email, /autoComplete="email"/);
});

test("chat da Viva: sem formulário próprio de nome e e-mail (E449: o chamado é o da Central, testado acima)", () => {
  const f = ler("../components/ajuda/viva-chat.tsx");
  assert.ok(!f.includes('aria-label="Seu nome"'));
  assert.ok(!f.includes('aria-label="Seu e-mail"'));
});

test("parceiros: cidade do fotógrafo e site do parceiro têm autocomplete", () => {
  // E52: o formulário da busca saiu da página para busca-fotografo.tsx (aviso de busca vazia).
  assert.match(tag(ler("../app/(public)/parceiros/fotografos/busca-fotografo.tsx"), 'id="cidade"'), /autoComplete="address-level2"/);
  // Prompt 31a: o formulário "Seja parceiro" (conta com e-mail confirmado) substituiu o de interesse.
  assert.match(tag(ler("../components/parceiros/seja-parceiro-form.tsx"), 'id="sp-telefone"'), /autoComplete="tel"/);
  assert.match(tag(ler("../components/parceiros/seja-parceiro-form.tsx"), 'id="sp-nome"'), /autoComplete="name"/);
});
