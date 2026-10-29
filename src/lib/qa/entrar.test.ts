/*
  QA-LOGIN-B — regras puras da entrada direta da QA.
  Roda: node --test src/lib/qa/entrar.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { chaveConfere, chaveLimiteConta, contaPermitida, emailNoPadrao, emailNormalizado, papelDaContaNova } from "./entrar.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("chave: só a certa confere; sem chave esperada nada confere", () => {
  assert.equal(chaveConfere("abc-123", "abc-123"), true);
  assert.equal(chaveConfere("abc-124", "abc-123"), false);
  assert.equal(chaveConfere("abc-123-mais-longa", "abc-123"), false);
  assert.equal(chaveConfere("", "abc"), false);
  assert.equal(chaveConfere(undefined, "abc"), false);
  assert.equal(chaveConfere("abc", undefined), false);
  assert.equal(chaveConfere("abc", ""), false);
});

test("chave: comparação em tempo constante (timingSafeEqual sobre resumos de mesmo tamanho)", () => {
  const src = ler("./entrar.ts");
  assert.match(src, /crypto\.timingSafeEqual\(a, b\)/);
  assert.doesNotMatch(src, /fornecida === esperada|esperada === fornecida/);
});

test("e-mail: normaliza e recusa o que não parece e-mail", () => {
  assert.equal(emailNormalizado("  QA.Ana@Exemplo.com "), "qa.ana@exemplo.com");
  assert.equal(emailNormalizado("sem-arroba"), "");
  assert.equal(emailNormalizado(42), "");
});

test("padrão: ancorado no e-mail inteiro; sem padrão ou padrão inválido não cria nada", () => {
  const p = String.raw`qa\+[a-z0-9.-]+@exemplo\.com`;
  assert.equal(emailNoPadrao("qa+morador1@exemplo.com", p), true);
  assert.equal(emailNoPadrao("qa+dono@exemplo.com", p), true);
  assert.equal(emailNoPadrao("pessoa@exemplo.com", p), false);
  assert.equal(emailNoPadrao("x-qa+a@exemplo.com.br", p), false, "âncora: não casa pedaço");
  assert.equal(emailNoPadrao("qa+a@exemplo.com", undefined), false);
  assert.equal(emailNoPadrao("qa+a@exemplo.com", "(["), false);
});

test("conta: só de teste, só morador ou proprietário, nunca administrador nem conta com 2FA", () => {
  assert.equal(contaPermitida({ role: "tenant", is_teste: true }, false), true);
  assert.equal(contaPermitida({ role: "owner", is_teste: true }, false), true);
  assert.equal(contaPermitida({ role: "tenant", is_teste: false }, false), false, "conta real");
  assert.equal(contaPermitida({ role: "admin", is_teste: true }, false), false, "admin, mesmo marcado de teste");
  assert.equal(contaPermitida({ role: "tenant", is_teste: true }, true), false, "com fator de 2FA");
  assert.equal(contaPermitida({ role: null, is_teste: true }, false), false);
  assert.equal(contaPermitida(null, false), false);
});

test("conta nova: papel pedido ou morador", () => {
  assert.equal(papelDaContaNova("owner"), "owner");
  assert.equal(papelDaContaNova("admin"), "tenant");
  assert.equal(papelDaContaNova(undefined), "tenant");
});

test("limite por conta usa o resumo, nunca o e-mail", () => {
  const k = chaveLimiteConta("qa+ana@exemplo.com");
  assert.doesNotMatch(k, /ana|exemplo/);
  assert.match(k, /^qa-entrar:conta:[0-9a-f]{32}$/);
});

test("guardas do servidor: 404 em tudo, sessão por generateLink + verifyOtp, chave nunca em log nem na URL", () => {
  const srv = ler("./entrar-servidor.ts");
  const rota = ler("../../app/api/qa/entrar/route.ts");
  const pagina = ler("../../app/qa/entrar/page.tsx");
  assert.match(srv, /generateLink\(\{ type: "magiclink", email \}\)/);
  assert.match(srv, /verifyOtp\(\{ type: "magiclink", token_hash/);
  assert.match(srv, /email_confirm: true/);
  assert.doesNotMatch(srv + rota, /console\.(log|error|warn|info)\([^)]*(chave|QA_LOGIN_KEY|email)/i);
  assert.match(rota, /status: 404/);
  // A página nunca lê a chave da query: com ?chave= / ?key= a página nem existe.
  assert.match(pagina, /notFound\(\)/);
  assert.doesNotMatch(pagina, /searchParams\??\.(chave|key)\b[^)]*\bvalue/);
  // O login das pessoas reais e o 2FA do admin não mudam por aqui.
  assert.doesNotMatch(srv, /signInWithOtp|is_admin\(/);
});
