/*
  E917 — /auth precisa dizer a validade REAL do código de 6 dígitos e do link de recuperação. O código já dizia
  "Ele vale por 10 minutos" no passo "Digite o código" (pós-envio); o aviso depois de pedir a recuperação não dizia
  nada. Os dois são OTP do e-mail no Supabase: valem o mesmo mailer_otp_exp, que o repositório fixa em
  VALIDADE_CODIGO_S (a Action dos e-mails confere). Os dois passos pós-envio leem a mesma constante.
  Roda: node --test src/lib/seguranca/e917-validade-codigo-e-link.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG_RECUPERACAO_ENVIADA, TEXTO_VALIDADE_CODIGO, VALIDADE_CODIGO_S, TAMANHO_CODIGO } from "./codigo-acesso.ts";
import { configEsperadaAuth } from "../notifications/supabase-auth-config.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("E917: a validade dita na tela é a mesma que o Supabase aplica (mailer_otp_exp)", () => {
  assert.equal(configEsperadaAuth().mailer_otp_exp, VALIDADE_CODIGO_S);
  assert.equal(TEXTO_VALIDADE_CODIGO, `${VALIDADE_CODIGO_S / 60} minutos`);
  assert.equal(TAMANHO_CODIGO, 6);
});

test("E917: o passo pós-envio da recuperação diz a validade real do link", () => {
  assert.ok(MSG_RECUPERACAO_ENVIADA.includes(`vale por ${TEXTO_VALIDADE_CODIGO}`));
  assert.match(MSG_RECUPERACAO_ENVIADA, /só funciona uma vez/);
  const p = ler("../../app/auth/page.tsx");
  assert.match(p, /setNotice\(MSG_RECUPERACAO_ENVIADA\)/);
  assert.doesNotMatch(p, /"Enviamos um link de recuperação para seu e-mail\. Abra-o/, "aviso sem validade voltou");
});

test("E917: o passo 'Digite o código' (pós-envio) diz a validade do código de 6 dígitos", () => {
  const c = ler("../../components/auth/login-por-codigo.tsx");
  assert.match(c, /Enviamos um código de 6 dígitos para \$\{email\.trim\(\)\}\. Ele vale por \$\{TEXTO_VALIDADE_CODIGO\}\./);
});
