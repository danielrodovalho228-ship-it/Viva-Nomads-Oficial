/*
  Lista /admin/usuarios (ordem 61454243): filtros vindos da URL do cartão.
  Roda: node --test src/lib/admin/usuarios-lista.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { cadastroCompleto, filtrosUsuarios, hrefUsuarios, rotuloFiltroUsuarios, termoBusca } from "./usuarios-lista.ts";

test("sem parâmetro: todos os usuários (donos e inquilinos)", () => {
  assert.deepEqual(filtrosUsuarios({}), { papel: null, fundador: false, desde: null, cadastro: null, q: null });
});

test("papel só aceita proprietario/inquilino; o resto é ignorado", () => {
  assert.equal(filtrosUsuarios({ papel: "proprietario" }).papel, "owner");
  assert.equal(filtrosUsuarios({ papel: "inquilino" }).papel, "tenant");
  assert.equal(filtrosUsuarios({ papel: "admin" }).papel, null);
  assert.equal(filtrosUsuarios({ papel: "x'; drop table profiles;--" }).papel, null);
});

test("fundador=1 liga o filtro; desde só aceita AAAA-MM-DD válida", () => {
  assert.equal(filtrosUsuarios({ fundador: "1" }).fundador, true);
  assert.equal(filtrosUsuarios({ fundador: "0" }).fundador, false);
  assert.equal(filtrosUsuarios({ desde: "2026-10-01" }).desde, "2026-10-01");
  assert.equal(filtrosUsuarios({ desde: "2026-13-45" }).desde, null);
  assert.equal(filtrosUsuarios({ desde: "ontem" }).desde, null);
});

test("hrefUsuarios monta a URL do cartão e rotulo descreve o filtro", () => {
  assert.equal(hrefUsuarios({}), "/admin/usuarios");
  assert.equal(hrefUsuarios({ fundador: true }), "/admin/usuarios?fundador=1");
  assert.equal(hrefUsuarios({ papel: "proprietario", desde: "2026-10-01" }), "/admin/usuarios?papel=proprietario&desde=2026-10-01");
  assert.equal(rotuloFiltroUsuarios({ papel: "owner", fundador: true, desde: null, cadastro: null, q: null }), "Proprietários · Fundadores");
  assert.equal(rotuloFiltroUsuarios({ papel: null, fundador: false, desde: null, cadastro: null, q: null }), "Todos os usuários");
});

test("cartões Usuários e Fundadores da visão geral abrem a lista", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../../app/(dashboard)/admin/visao-geral-client.tsx", import.meta.url), "utf8");
  assert.match(src, /label="Usuários"[^\n]*href=\{hrefUsuarios\(\{\}\)\}/);
  assert.match(src, /label="Fundadores"[^\n]*href=\{hrefUsuarios\(\{ fundador: true \}\)\}/);
});

test("cadastro completo = nome e telefone preenchidos (a lista nunca mostra o telefone)", () => {
  assert.equal(cadastroCompleto({ full_name: "Ana Souza", phone: "11999990000" }), true);
  assert.equal(cadastroCompleto({ full_name: "Ana Souza", phone: null }), false);
  assert.equal(cadastroCompleto({ full_name: "  ", phone: "11999990000" }), false);
  assert.equal(cadastroCompleto({ full_name: null, phone: null }), false);
});

test("filtro cadastro aceita só completo/incompleto e vai para a URL", () => {
  assert.equal(filtrosUsuarios({ cadastro: "incompleto" }).cadastro, "incompleto");
  assert.equal(filtrosUsuarios({ cadastro: "completo" }).cadastro, "completo");
  assert.equal(filtrosUsuarios({ cadastro: "tanto-faz" }).cadastro, null);
  assert.equal(hrefUsuarios({ cadastro: "incompleto" }), "/admin/usuarios?cadastro=incompleto");
});

test("busca por nome: limpa curingas e caracteres de filtro, limita o tamanho", () => {
  assert.equal(filtrosUsuarios({ q: "  Ana  " }).q, "Ana");
  assert.equal(termoBusca("50%_off"), "50off");
  assert.equal(termoBusca("a,b(c)\\d"), "abcd");
  assert.equal(termoBusca("x".repeat(200))?.length, 60);
  assert.equal(termoBusca("   "), null);
  assert.equal(filtrosUsuarios({ q: "Ana" }).q, "Ana");
  assert.equal(hrefUsuarios({ q: "Ana Souza" }), "/admin/usuarios?q=Ana+Souza");
});

test("Fundadores usa o mesmo critério do cartão: qualquer perfil com fundador, sem filtro de papel", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../../app/(dashboard)/admin/usuarios/page.tsx", import.meta.url), "utf8");
  assert.match(src, /if \(f\.fundador\) q = q\.eq\("fundador", true\)/);
  assert.match(src, /if \(!f\.fundador\)/);
});
