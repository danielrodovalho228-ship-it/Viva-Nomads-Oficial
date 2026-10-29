/*
  QA-LOGIN-B — regras puras da porta de QA (contas de teste e admin observador).
  Roda: node --test src/lib/qa/entrar.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  QA_ADMIN_VALIDO_ATE,
  chaveConfere,
  chaveLimiteConta,
  destinoParaRegistro,
  emailNoPadrao,
  emailNormalizado,
  hashValido,
  papelDaContaNova,
  portaAdminQaAberta,
  sha256Hex,
  tipoDeEntrada,
} from "./entrar.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const CHAVE = "chave-de-teste-nao-real";
const HASH = sha256Hex(CHAVE);

test("chave: conferida pelo HASH (sha256 hex); só a certa confere; sem hash válido nada confere", () => {
  assert.equal(hashValido(HASH), true);
  assert.equal(chaveConfere(CHAVE, HASH), true);
  assert.equal(chaveConfere(CHAVE, HASH.toUpperCase()), true, "hex em maiúsculas também vale");
  assert.equal(chaveConfere(`${CHAVE}x`, HASH), false);
  assert.equal(chaveConfere("", HASH), false);
  assert.equal(chaveConfere(undefined, HASH), false);
  assert.equal(chaveConfere(CHAVE, undefined), false);
  assert.equal(chaveConfere(CHAVE, CHAVE), false, "a chave em claro na env NÃO vale: só o hash");
  assert.equal(chaveConfere(CHAVE, "abc"), false);
});

test("chave: comparação em tempo constante e nenhuma chave em claro lida da env", () => {
  const src = ler("./entrar.ts");
  assert.match(src, /crypto\.timingSafeEqual\(a, b\)/);
  assert.doesNotMatch(src, /fornecida === |=== fornecida/);
  const srv = ler("./entrar-servidor.ts") + ler("../../app/api/qa/entrar/route.ts") + ler("../../app/qa/entrar/page.tsx");
  assert.match(srv, /process\.env\.QA_LOGIN_KEY_HASH/);
  assert.doesNotMatch(srv, /process\.env\.QA_LOGIN_KEY\b(?!_HASH)/, "a chave em claro nunca é lida");
});

test("e-mail: normaliza e recusa o que não parece e-mail", () => {
  assert.equal(emailNormalizado("  QA.Ana@Exemplo.com "), "qa.ana@exemplo.com");
  assert.equal(emailNormalizado("sem-arroba"), "");
  assert.equal(emailNormalizado(42), "");
});

test("padrão: ancorado no e-mail inteiro; sem padrão ou padrão inválido não cria nada", () => {
  const p = String.raw`qa\+[a-z0-9.-]+@exemplo\.com`;
  assert.equal(emailNoPadrao("qa+morador1@exemplo.com", p), true);
  assert.equal(emailNoPadrao("pessoa@exemplo.com", p), false);
  assert.equal(emailNoPadrao("x-qa+a@exemplo.com.br", p), false, "âncora: não casa pedaço");
  assert.equal(emailNoPadrao("qa+a@exemplo.com", undefined), false);
  assert.equal(emailNoPadrao("qa+a@exemplo.com", "(["), false);
});

test("contas aceitas: teste (morador/proprietário, sem 2FA) e o admin observador; qualquer outra → null (404)", () => {
  assert.equal(tipoDeEntrada({ role: "tenant", is_teste: true }, false, true), "teste");
  assert.equal(tipoDeEntrada({ role: "owner", is_teste: true }, false, true), "teste");
  assert.equal(tipoDeEntrada({ role: "tenant", is_teste: false }, false, true), null, "cliente real");
  assert.equal(tipoDeEntrada({ role: "admin", is_teste: false }, true, true), null, "admin comum / Daniel");
  assert.equal(tipoDeEntrada({ role: "admin", is_teste: true }, false, true), null, "admin marcado de teste, sem qa_admin");
  assert.equal(tipoDeEntrada({ role: "tenant", is_teste: true }, true, true), null, "conta de teste com 2FA");
  assert.equal(tipoDeEntrada({ role: "admin", is_teste: true, qa_admin: true }, true, true), "admin_qa", "observador entra (com o 2FA dele)");
  assert.equal(tipoDeEntrada({ role: "admin", is_teste: true, qa_admin: true }, true, false), null, "porta do admin desligada");
  assert.equal(tipoDeEntrada({ role: "admin", is_teste: false, qa_admin: true }, true, true), null, "observador precisa ser de teste");
  assert.equal(tipoDeEntrada({ role: "tenant", is_teste: true, qa_admin: true }, false, true), null, "qa_admin sem papel admin");
  assert.equal(tipoDeEntrada(null, false, true), null);
});

test("desligamento automático do admin observador: PRE_LANCAMENTO=off OU depois de QA_ADMIN_VALIDO_ATE", () => {
  assert.equal(QA_ADMIN_VALIDO_ATE, "2026-12-31");
  const antes = new Date("2026-11-15T12:00:00Z");
  assert.equal(portaAdminQaAberta(antes, undefined), true, "pré-lançamento ligado por padrão");
  assert.equal(portaAdminQaAberta(antes, "on"), true);
  assert.equal(portaAdminQaAberta(antes, "off"), false, "gatilho 1: lançamento");
  assert.equal(portaAdminQaAberta(antes, " OFF "), false);
  assert.equal(portaAdminQaAberta(new Date("2027-01-01T02:59:00Z"), undefined), true, "31/12 23:59 em Brasília ainda vale");
  assert.equal(portaAdminQaAberta(new Date("2027-01-01T03:00:00Z"), undefined), false, "gatilho 2: 01/01 em Brasília");
});

test("conta nova: papel pedido ou morador; nunca admin", () => {
  assert.equal(papelDaContaNova("owner"), "owner");
  assert.equal(papelDaContaNova("admin"), "tenant");
  assert.equal(papelDaContaNova(undefined), "tenant");
});

test("registro: destino só com o caminho; limite por conta usa o resumo, nunca o e-mail", () => {
  assert.equal(destinoParaRegistro("/admin/usuarios?q=pessoa@exemplo.com#x"), "/admin/usuarios");
  assert.equal(destinoParaRegistro("/dashboard"), "/dashboard");
  const k = chaveLimiteConta("qa+ana@exemplo.com");
  assert.doesNotMatch(k, /ana|exemplo/);
  assert.match(k, /^qa-entrar:conta:[0-9a-f]{32}$/);
});

test("guardas do servidor: 404 em tudo, sessão por generateLink + verifyOtp, nada sensível em log nem na URL", () => {
  const srv = ler("./entrar-servidor.ts");
  const rota = ler("../../app/api/qa/entrar/route.ts");
  const pagina = ler("../../app/qa/entrar/page.tsx");
  assert.match(srv, /generateLink\(\{ type: "magiclink", email \}\)/);
  assert.match(srv, /verifyOtp\(\{ type: "magiclink", token_hash/);
  assert.match(srv, /email_confirm: true/);
  assert.match(srv, /insert\(\{ usuario_id: userId, tipo, ip_hash: ipHash, destino, conta_criada: criada \}\)/);
  assert.doesNotMatch(srv + rota, /console\.(log|error|warn|info)\(/, "a porta não escreve log");
  assert.match(rota, /status: 404/);
  assert.match(pagina, /"chave" in sp \|\| "key" in sp\) notFound\(\)/);
  // PRE_LANCAMENTO lido na hora (não inlinado no build), para o desligamento valer sem novo build.
  assert.match(srv, /\["NEXT_PUBLIC", "PRE_LANCAMENTO"\]\.join\("_"\)/);
  // O login das pessoas reais, is_admin() e o 2FA do admin não mudam por aqui.
  assert.doesNotMatch(srv, /signInWithOtp|is_admin\(|unenroll|mfa\.(enroll|verify)/);
});
