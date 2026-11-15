/*
  E744, passo 4 (15/11/2026) — t14 "Conta em lista e as 5 abas do proprietário" (projeto app-mobile, 390 px) e t568 "390 px —
  o menu da Conta…": a mesma causa.
  Verde em 12/11, vermelho desde 13/11; falhou 3 de 3 vezes isolado na main 403858f7.

  Causa: o E798 (12/11) fez o servidor (proxy) mandar /dashboard/conta para o Perfil quando o cookie da largura da tela
  (`vn-tela`) diz "larga". A sessão que a suíte grava na preparação é feita a 1280 px e leva `vn-tela=larga`; o teste roda a
  390 px e abria /dashboard/conta antes de a casca do painel regravar o cookie para "estreita". Caía no Perfil, onde o link
  "Perfil" do menu da Conta não existe.

  Um celular de verdade nunca tem "larga" nesse cookie. O teste passa a esperar o que a casca faz na primeira tela a 390 px
  (gravar "estreita") antes de abrir a Conta — a mesma espera do t1611. Nenhuma asserção mudou.

  Roda: node --test tests/laboratorio/e744-t14-cookie-da-largura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COOKIE_TELA, redirecionamentoDaConta, telaDaLargura } from "../../src/lib/conta/redirecionar-no-servidor.ts";

const t14 = readFileSync("tests/e2e/specs/t14-app-mode.spec.ts", "utf8");

test("E744 t14: a regra do proxy que o teste respeita — /dashboard/conta só vai ao Perfil com o cookie 'larga'", () => {
  assert.equal(COOKIE_TELA, "vn-tela");
  assert.equal(telaDaLargura(390), "estreita");
  assert.equal(redirecionamentoDaConta("/dashboard/conta", new URLSearchParams(""), "estreita"), null);
  assert.equal(redirecionamentoDaConta("/dashboard/conta", new URLSearchParams(""), "larga"), "/dashboard/conta/perfil");
});

const fixture = readFileSync("tests/e2e/fixtures/tela-do-aparelho.ts", "utf8");
const t568 = readFileSync("tests/e2e/specs/t568-e176-parte2-conta.spec.ts", "utf8");

test("E744: a espera cobra o cookie que a casca grava, pelo nome que o produto usa", () => {
  assert.match(fixture, /export async function esperarTelaEstreita\(page: Page\)/);
  assert.match(fixture, /c\.name === COOKIE_TELA/);
  assert.match(fixture, /\.toBe\("estreita"\)/);
});

test("E744 t14: o teste do proprietário espera a casca gravar a tela estreita antes de abrir a Conta; as asserções ficam", () => {
  const i = t14.indexOf('test("Conta em lista e as 5 abas do proprietário"');
  assert.ok(i > 0, "o teste existe");
  const corpo = t14.slice(i, t14.indexOf("\n    });", i));
  const espera = corpo.indexOf("esperarTelaEstreita(page)");
  const abreConta = corpo.indexOf('page.goto("/dashboard/conta"');
  assert.ok(espera > 0 && abreConta > espera, "espera a tela estreita ANTES de abrir /dashboard/conta");
  // As cobranças de antes continuam no teste.
  assert.match(corpo, /conferirAbas\(page, ABAS_PROPRIETARIO\)/);
  assert.match(corpo, /getByRole\("link", \{ name: \/\^Perfil\/ \}\)\)\.toBeVisible\(\)/);
  assert.match(corpo, /getByRole\("button", \{ name: \/\^Sair\/ \}\)\)\.toBeVisible\(\)/);
  assert.match(corpo, /locator\("aside nav"\)\.first\(\)\)\.toBeHidden\(\)/);
});

test("E744 t568: o teste de 390 px abre o painel, espera a tela estreita e só então abre a Conta; as asserções ficam", () => {
  const i = t568.indexOf('test("390 px — o menu da Conta lista Segurança e verificações');
  assert.ok(i > 0, "o teste existe");
  const corpo = t568.slice(i);
  const painel = corpo.indexOf('page.goto("/dashboard", ');
  const espera = corpo.indexOf("esperarTelaEstreita(page)");
  const abreConta = corpo.indexOf('page.goto("/dashboard/conta", ');
  assert.ok(painel > 0 && espera > painel && abreConta > espera, "painel → espera → Conta, nessa ordem");
  assert.match(corpo, /getByTestId\("conta-menu"\)\.getByRole\("link", \{ name: \/Segurança e verificações\/ \}\)/, "a cobrança do menu continua");
});
