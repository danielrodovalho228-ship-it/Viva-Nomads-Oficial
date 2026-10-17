/*
  Ordem ec7988fe (item 2): Conta no modo app no padrão 3S.
  node --test (sem alias @).
*/
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const menu = readFileSync(new URL("../components/account/conta-menu.tsx", import.meta.url), "utf8");
const secao = readFileSync(new URL("../app/(dashboard)/dashboard/conta/[secao]/page.tsx", import.meta.url), "utf8");

test("menu da Conta no app abre com a capa 'conta' do PageTitle", () => {
  assert.match(menu, /<PageTitle[^>]*capa="conta"/);
});

test("cada item do menu tem ícone, título e descrição curta", () => {
  const itens = menu.match(/\{\s*(?:href|onClick):[^}]*\}/g) ?? [];
  assert.ok(itens.length >= 10, `esperava ao menos 10 itens, achei ${itens.length}`);
  for (const it of itens) assert.match(it, /descricao: "/, `item sem descrição: ${it}`);
  assert.match(menu, /\{it\.descricao &&/);
});

test("subtelas /dashboard/conta/[secao] têm PageTitle", () => {
  for (const s of ["perfil", "seguranca", "notificacoes", "excluir"]) {
    assert.match(secao, new RegExp(`TITULOS\\.${s}\\.titulo`), s);
  }
});

test("Fechar datas: o indicador de carregamento some e a falha aparece com 'Tentar de novo'", () => {
  const cal = readFileSync(new URL("../components/property/block-calendar.tsx", import.meta.url), "utf8");
  assert.match(cal, /\.finally\(\(\) => \{[\s\S]{0,80}setCarregando\(false\)/);
  assert.match(cal, /data-testid="bloqueios-erro"/);
  assert.match(cal, /Tentar de novo/);
});
