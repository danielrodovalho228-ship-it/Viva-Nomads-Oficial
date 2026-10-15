/*
  Ordem c27c7ae6 — login no iPhone: e-mail sem autocorreção e sem espaços,
  prefetch reconhecido no proxy, cookie de sessão detectado sem rede.
  Roda: node --test src/lib/login-celular.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { ATRIBUTOS_EMAIL, limparEmail, precisaVerificarUsuario, requisicaoPrefetch, temCookieSessao } from "./login-celular.ts";

test("e-mail: iPhone não capitaliza nem autocorrige", () => {
  assert.equal(ATRIBUTOS_EMAIL.autoCapitalize, "none");
  assert.equal(ATRIBUTOS_EMAIL.autoCorrect, "off");
  assert.equal(ATRIBUTOS_EMAIL.spellCheck, false);
  assert.equal(ATRIBUTOS_EMAIL.inputMode, "email");
});

test("limparEmail tira espaços das pontas e o espaço que o teclado põe após a sugestão", () => {
  assert.equal(limparEmail("  ana@exemplo.com.br \n"), "ana@exemplo.com.br");
  assert.equal(limparEmail("ana@exemplo.com.br"), "ana@exemplo.com.br");
});

test("requisicaoPrefetch reconhece os dois cabeçalhos e ignora navegação normal", () => {
  const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
  assert.equal(requisicaoPrefetch(h({ "next-router-prefetch": "1" })), true);
  assert.equal(requisicaoPrefetch(h({ purpose: "prefetch" })), true);
  assert.equal(requisicaoPrefetch(h({ "sec-purpose": "prefetch;prerender" })), true);
  assert.equal(requisicaoPrefetch(h({})), false);
  assert.equal(requisicaoPrefetch(h({ rsc: "1" })), false);
});

test("temCookieSessao: só com cookie de sessão do Supabase", () => {
  assert.equal(temCookieSessao([{ name: "sb-abc-auth-token" }]), true);
  assert.equal(temCookieSessao([{ name: "sb-abc-auth-token.0" }, { name: "x" }]), true);
  assert.equal(temCookieSessao([{ name: "vn_app" }, { name: "sb-abc-code-verifier" }]), false);
  assert.equal(temCookieSessao([]), false);
});

test("precisaVerificarUsuario: visitante sem sessão não consulta o servidor de autenticação", () => {
  assert.equal(precisaVerificarUsuario([]), false);
  assert.equal(precisaVerificarUsuario([{ name: "vn_app" }]), false);
  assert.equal(precisaVerificarUsuario([{ name: "sb-abc-auth-token.0" }]), true);
});
