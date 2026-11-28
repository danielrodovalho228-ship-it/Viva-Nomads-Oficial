/*
  F11 — o login devolve a pessoa ao destino COM a query.
  Roda: node --test src/lib/destino-login.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { destinoAposLogin, destinoComAncoraDoLogin, destinoQualificarSemImovel } from "./destino-login.ts";
import { safeInternalPath } from "./safe-redirect.ts";

const ID = "3f2b8c1e-1a2b-4c3d-9e8f-001122334455";

test("guarda a query do destino (?imovel=…)", () => {
  assert.equal(destinoAposLogin("/qualificar", `?imovel=${ID}`), `/qualificar?imovel=${ID}`);
  assert.equal(destinoAposLogin("/admin/socios", "?aba=caixa&p=2"), "/admin/socios?aba=caixa&p=2");
  assert.equal(destinoAposLogin("/dashboard", ""), "/dashboard");
});

test("o valor sobrevive à ida e volta pelo /auth?redirect=", () => {
  const u = new URL("https://x.test/auth");
  u.searchParams.set("redirect", destinoAposLogin("/qualificar", `?imovel=${ID}`));
  assert.equal(safeInternalPath(u.searchParams.get("redirect")), `/qualificar?imovel=${ID}`);
});

test("negativo: destino externo/estranho nunca vira redirect aberto", () => {
  assert.equal(destinoAposLogin("//evil.com", ""), "/dashboard");
  assert.equal(destinoAposLogin("/dashboard", "?x=\n//evil.com"), "/dashboard");
});

test("/qualificar sem imóvel: sempre o cadastro novo (E132-A; ele oferece retomar o rascunho)", () => {
  assert.equal(destinoQualificarSemImovel(), "/dashboard/imoveis/novo");
});

/*
  E1002 (Gerente, 17/11/2026) — a âncora do link sobrevive ao login. O proxy só vê caminho e consulta (a âncora não chega
  ao servidor), mas o navegador a mantém ao seguir o redirecionamento para /auth: /dashboard/conta#documento, aberto sem
  sessão, chega a /auth?redirect=%2Fdashboard%2Fconta#documento. A tela do login junta a âncora ao destino.
*/
test("E1002: a âncora que chegou ao /auth volta para o destino", () => {
  assert.equal(destinoComAncoraDoLogin("/dashboard/conta", "#documento"), "/dashboard/conta#documento");
  assert.equal(destinoComAncoraDoLogin("/dashboard/conta/dados", "#documento"), "/dashboard/conta/dados#documento");
  assert.equal(destinoComAncoraDoLogin(`/dashboard/imoveis/${ID}/editar?aba=1`, "#secao-regras"), `/dashboard/imoveis/${ID}/editar?aba=1#secao-regras`);
  // Sem âncora, o destino fica como estava.
  assert.equal(destinoComAncoraDoLogin("/dashboard/conta", ""), "/dashboard/conta");
  assert.equal(destinoComAncoraDoLogin("/dashboard/conta", "#"), "/dashboard/conta");
  // O destino que já traz âncora própria vence.
  assert.equal(destinoComAncoraDoLogin("/dashboard/conta/dados#telefone", "#documento"), "/dashboard/conta/dados#telefone");
});

test("E1002 negativo: só âncora simples (nome de seção); nada que pareça credencial, endereço ou comando entra no destino", () => {
  for (const estranha of [
    "#access_token=abc.def&refresh_token=xyz&type=recovery", // resposta de login por link: nunca vai para o destino
    "#error=access_denied&error_description=x",
    "#//evil.com",
    "#/outro/caminho",
    "#a b",
    "#a%0Ab",
    "#" + "a".repeat(65),
    "documento", // sem o "#"
    "#javascript:alert(1)",
  ])
    assert.equal(destinoComAncoraDoLogin("/dashboard/conta", estranha), "/dashboard/conta", estranha);
  // O resultado continua sendo caminho interno pelo mesmo filtro do /auth (A7).
  assert.equal(safeInternalPath(destinoComAncoraDoLogin("/dashboard/conta", "#documento")), "/dashboard/conta#documento");
});

test("E1002: a tela do login junta a âncora ao destino guardado, e só quando há destino guardado", () => {
  const tela = readFileSync(new URL("../app/auth/page.tsx", import.meta.url), "utf8");
  const funcao = tela.slice(tela.indexOf("function postAuthTarget()"), tela.indexOf("/** Conta uma falha de login"));
  assert.match(funcao, /const guardado = new URLSearchParams\(window\.location\.search\)\.get\("redirect"\);/);
  assert.match(funcao, /const destino = safeInternalPath\(guardado\);/, "o filtro anti open redirect (A7) continua na frente");
  assert.match(funcao, /return guardado \? destinoComAncoraDoLogin\(destino, window\.location\.hash\) : destino;/);
  // Todo caminho de entrada da tela passa por postAuthTarget (senha, código, sem banco): nenhum lê o destino por fora.
  assert.equal((tela.match(/searchParams\.get\("redirect"\)|\.get\("redirect"\)/g) ?? []).length, 1);
});
