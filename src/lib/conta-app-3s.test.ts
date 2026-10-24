/*
  Ordem ec7988fe (item 2): Conta no modo app no padrão 3S.
  node --test (sem alias @).
*/
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const menu = readFileSync(new URL("../components/account/conta-menu.tsx", import.meta.url), "utf8");
const secao = readFileSync(new URL("../app/(dashboard)/dashboard/conta/[secao]/page.tsx", import.meta.url), "utf8");

test("menu da Conta no celular: um H1 só ('Conta'), sem capa de foto (A1; Prompt 42)", () => {
  const pagina = readFileSync(new URL("../app/(dashboard)/dashboard/conta/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(menu, /<PageTitle/);
  assert.doesNotMatch(menu, /conta-cartao-usuario/);
  assert.doesNotMatch(menu, /capa=/);
  assert.match(pagina, /<div className="lg:hidden">\s*<ContaMenu \/>/);
  assert.equal((menu.match(/<h1\b/g) ?? []).length, 1);
});

test("cada item do menu tem ícone, título e descrição curta", () => {
  const itens = menu.match(/\{\s*(?:href|onClick):[^}]*\}/g) ?? [];
  assert.ok(itens.length >= 10, `esperava ao menos 10 itens, achei ${itens.length}`);
  // As oito seções vêm de SECOES_CONTA (cada uma com descrição); os outros itens têm a descrição escrita.
  for (const it of itens) assert.match(it, /descricao: (?:"|s\.descricao)/, `item sem descrição: ${it}`);
  for (const d of readFileSync(new URL("./conta/secoes.ts", import.meta.url), "utf8").match(/\{ id: "[^}]*\}/g) ?? []) assert.match(d, /descricao: "/, d);
  assert.match(menu, /\{it\.descricao &&/);
});

test("subtelas /dashboard/conta/[secao] têm o título da casca (um H1) e os endereços antigos continuam", () => {
  const casca = readFileSync(new URL("../components/account/casca-conta.tsx", import.meta.url), "utf8");
  assert.match(casca, /<h1 [^>]*data-testid="conta-h1"/);
  assert.match(casca, /data-testid="conta-voltar"/);
  for (const s of ["avaliacoes", "papeis", "dados", "privacidade", "notificacoes", "pagamentos", "ajuda"]) assert.match(secao, new RegExp(`case "${s}"`), s);
  assert.match(secao, /ALIAS_SECAO\[bruta\]/);
  assert.match(readFileSync(new URL("./conta/secoes.ts", import.meta.url), "utf8"), /seguranca: "privacidade",\s*excluir: "ajuda"/);
});

test("Fechar datas: o indicador de carregamento some e a falha aparece com 'Tentar de novo'", () => {
  const cal = readFileSync(new URL("../components/property/block-calendar.tsx", import.meta.url), "utf8");
  assert.match(cal, /\.finally\(\(\) => \{[\s\S]{0,80}setCarregando\(false\)/);
  assert.match(cal, /data-testid="bloqueios-erro"/);
  assert.match(cal, /Tentar de novo/);
});
