/*
  CAPTCHA (Turnstile) no cadastro, login, "esqueci a senha" e reautenticação da Conta.
  Roda: node --test src/lib/seguranca/captcha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { captchaLigado, comCaptcha, erroDeCaptcha, podeEnviar } from "./captcha.ts";
import { friendlyAuthError } from "../auth-errors.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("sem chave pública = desligado (lab/dev seguem funcionando)", () => {
  assert.equal(captchaLigado(undefined), false);
  assert.equal(captchaLigado(""), false);
  assert.equal(captchaLigado("   "), false);
  assert.equal(captchaLigado("0x4AAAAAAA"), true);
  assert.equal(podeEnviar(false, null), true);
  assert.equal(podeEnviar(true, null), false);
  assert.equal(podeEnviar(true, "tok"), true);
});

test("token vai nas opções do Supabase só quando existe", () => {
  assert.deepEqual(comCaptcha({ redirectTo: "x" }, null), { redirectTo: "x" });
  assert.deepEqual(comCaptcha({ redirectTo: "x" }, "tok"), { redirectTo: "x", captchaToken: "tok" });
});

test("erro de CAPTCHA do Supabase vira mensagem clara", () => {
  assert.equal(erroDeCaptcha("captcha protection: request disallowed (timeout-or-duplicate)"), true);
  assert.equal(erroDeCaptcha("Invalid login credentials"), false);
  assert.match(friendlyAuthError("captcha verification process failed"), /não é um robô/);
});

test("todas as chamadas de senha do navegador mandam o token (senão quebram com o CAPTCHA ligado)", () => {
  const auth = ler("app/auth/page.tsx");
  assert.match(auth, /signUp\(\{[\s\S]{0,200}options: comCaptcha\(/);
  assert.match(auth, /signInWithPassword\(\{ email, password, options: comCaptcha\(\{\}, captcha\.token\) \}\)/);
  assert.match(auth, /resetPasswordForEmail\(email, comCaptcha\(/);
  assert.match(auth, /resend\(\{[\s\S]{0,200}options: comCaptcha\(/);
  const conta = ler("components/account/conta-secoes.tsx");
  assert.equal((conta.match(/signInWithPassword\(\{[\s\S]{0,120}options: comCaptcha\(\{\}, captcha\.token\)/g) ?? []).length, 2);
  // Nenhuma outra chamada de senha no navegador sem token.
  const todas = (auth + conta).match(/signInWithPassword\(|signUp\(|resetPasswordForEmail\(|auth\.resend\(/g) ?? [];
  assert.equal(todas.length, 6);
});

test("CSP libera o Turnstile (script e iframe)", () => {
  const cfg = readFileSync(new URL("../../../next.config.ts", import.meta.url), "utf8");
  assert.match(cfg, /script-src [^"]*https:\/\/challenges\.cloudflare\.com/);
  assert.match(cfg, /frame-src [^"]*https:\/\/challenges\.cloudflare\.com/);
});
