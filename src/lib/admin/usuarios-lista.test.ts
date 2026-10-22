/*
  Lista /admin/usuarios (ordem 61454243): filtros vindos da URL do cartão.
  Roda: node --test src/lib/admin/usuarios-lista.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { cadastroCompleto, faltaNoCadastro, itensCadastro, filtrosUsuarios, hrefUsuarios, rotuloFiltroUsuarios, termoBusca } from "./usuarios-lista.ts";

test("sem parâmetro: todos os usuários (donos e inquilinos)", () => {
  assert.deepEqual(filtrosUsuarios({}), { papel: null, fundador: false, desde: null, ate: null, cadastro: null, q: null, comAnuncio: false, teste: false });
});

test("papel aceita proprietario/inquilino/admin (Prompt 29: o admin aparece na lista); o resto é ignorado", () => {
  assert.equal(filtrosUsuarios({ papel: "proprietario" }).papel, "owner");
  assert.equal(filtrosUsuarios({ papel: "inquilino" }).papel, "tenant");
  assert.equal(filtrosUsuarios({ papel: "admin" }).papel, "admin");
  assert.equal(filtrosUsuarios({ papel: "root" }).papel, null);
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
  assert.equal(rotuloFiltroUsuarios({ papel: "owner", fundador: true, desde: null, ate: null, cadastro: null, q: null, comAnuncio: false, teste: false }), "Proprietários · Fundadores");
  assert.equal(rotuloFiltroUsuarios({ papel: null, fundador: false, desde: null, ate: null, cadastro: null, q: null, comAnuncio: false, teste: false }), "Todos os usuários");
});

test("números Usuários e Fundadores da visão geral abrem a lista", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../../app/(dashboard)/admin/visao-geral-client.tsx", import.meta.url), "utf8");
  assert.match(src, /rotulo: "Usuários"[^\n]*href: hrefUsuarios\(\{\}\)/);
  assert.match(src, /rotulo: "Fundadores"[^\n]*href: hrefUsuarios\(\{ fundador: true \}\)/);
});

test("cadastro completo = nome + e-mail confirmado + documento + foto (a mesma regra da Conta; telefone não entra)", () => {
  const ok = { nome: "Ana Souza", emailConfirmado: true, cpf: "52998224725", cnpj: null, foto: true };
  assert.equal(cadastroCompleto(ok), true);
  assert.equal(cadastroCompleto({ ...ok, cpf: null, cnpj: "11222333000181" }), true, "CNPJ também vale como documento");
  assert.equal(cadastroCompleto({ ...ok, nome: "  " }), false);
  assert.equal(cadastroCompleto({ ...ok, emailConfirmado: false }), false);
  assert.equal(cadastroCompleto({ ...ok, cpf: null }), false);
  assert.equal(cadastroCompleto({ ...ok, foto: false }), false);
  assert.equal(faltaNoCadastro({ ...ok, cpf: null, foto: false }), "Documento (CPF ou CNPJ) e Foto de perfil");
  assert.deepEqual(itensCadastro(ok).map((i) => i.chave), ["nome", "email", "documento", "foto"]);
});

test("Conta e admin usam a MESMA função de cadastro completo", async () => {
  const { readFileSync } = await import("node:fs");
  const conta = readFileSync(new URL("../data/perfil-actions.ts", import.meta.url), "utf8");
  const admin = readFileSync(new URL("../../app/(dashboard)/admin/usuarios/page.tsx", import.meta.url), "utf8");
  assert.match(conta, /from "@\/lib\/perfil\/cadastro-completo"/);
  assert.match(admin, /cadastroCompleto\(/);
  assert.doesNotMatch(admin, /phone/, "a regra nova não lê profiles.phone");
});

test("filtros novos: com anúncio, contas de teste (padrão não) e período de/até", () => {
  assert.equal(filtrosUsuarios({ com_anuncio: "1" }).comAnuncio, true);
  assert.equal(filtrosUsuarios({}).teste, false);
  assert.equal(filtrosUsuarios({ teste: "sim" }).teste, true);
  assert.deepEqual([filtrosUsuarios({ de: "2026-10-01", ate: "2026-10-19" }).desde, filtrosUsuarios({ de: "2026-10-01", ate: "2026-10-19" }).ate], ["2026-10-01", "2026-10-19"]);
  assert.equal(hrefUsuarios({ comAnuncio: true }), "/admin/usuarios?com_anuncio=1");
  assert.equal(hrefUsuarios({ papel: "admin", teste: true }), "/admin/usuarios?papel=admin&teste=sim");
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
