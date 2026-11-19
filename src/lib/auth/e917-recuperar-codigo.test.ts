/*
  E917 (opção A, decisão do Gerente 16/11) — a recuperação de senha das contas de teste por código de 6 dígitos.
  O ciclo completo (pedido → caixa de teste → reset → login; uso único; expiração; conta real) é o T1680 do laboratório.
  Roda: node --test src/lib/auth/e917-recuperar-codigo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emailRecuperacaoComCodigo, ROTA_RESET_CODIGO, templatesSupabase } from "../notifications/templates-supabase.ts";
import { semLinksComToken } from "../notifications/caixa-teste.ts";
import { codigoRecuperacaoValido } from "./recuperar-codigo.ts";
import { TEXTO_VALIDADE_CODIGO } from "../seguranca/codigo-acesso.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("E917 — o e-mail de recuperação da conta de teste leva só o código (nenhum link de acesso) e a validade real", () => {
  const { assunto, html } = emailRecuperacaoComCodigo("482913");
  assert.equal(assunto, "Redefinir sua senha · Viva Nomads");
  assert.match(html, /482913/);
  assert.doesNotMatch(html, /token_hash|\/auth\/confirm|\{\{/);
  assert.ok(html.includes(TEXTO_VALIDADE_CODIGO) && html.includes("só funciona uma vez"));
  // O caminho onde digitar não tem parâmetro: a captura (E163) não o apaga — e a E163 continua apagando link com token.
  assert.equal(semLinksComToken(`https://vivanomads.com.br${ROTA_RESET_CODIGO}`), `https://vivanomads.com.br${ROTA_RESET_CODIGO}`);
  assert.equal(semLinksComToken("https://vivanomads.com.br/auth/confirm?token_hash=abc&type=recovery"), "[link com token removido]");
  assert.throws(() => emailRecuperacaoComCodigo("12ab56"));
  // Os modelos colados no Supabase (conta real) não mudam: o "Reset password" segue com o botão de link.
  assert.match(templatesSupabase().find((t) => t.modelo === "Reset password")!.html, /token_hash=\{\{ \.TokenHash \}\}&type=recovery/);
});

test("E917 — a rota só age para profiles.is_teste; conta real não recebe nada daqui (asserção negativa)", () => {
  const rota = ler("src/app/api/auth/recuperar/route.ts");
  assert.match(rota, /if \(!teste \|\| !admin\) return NextResponse\.json\(\{ ok: true, porCodigo: false \}\)/);
  assert.doesNotMatch(rota, /resetPasswordForEmail\(|\bsendEmail\(/, "conta real: nada sai da rota");
  const lib = ler("src/lib/auth/recuperar-senha.ts");
  assert.match(lib, /\.eq\("is_teste", true\)/);
  assert.match(lib, /generateLink\(\{ type: "recovery", email \}\)/);
  assert.match(lib, /evento: "recuperar_senha"/);
});

test("E917 — /auth: conta de teste segue para o código; qualquer outra, o MESMO pedido de sempre ao Supabase", () => {
  const p = ler("src/app/auth/page.tsx");
  const i = p.indexOf('fetch("/api/auth/recuperar"');
  assert.ok(i > 0);
  const j = p.indexOf("resetPasswordForEmail(email, comCaptcha({ redirectTo: `${SITE_URL}/auth/reset` }, captcha.token))");
  assert.ok(j > i, "o pedido de sempre continua, depois da rota");
  assert.match(p.slice(i, j), /if \(r\.porCodigo\) \{[\s\S]*router\.push\(`\/auth\/reset\/codigo\?email=/);
});

test("E917 — /auth/reset/codigo troca o código pela sessão de recuperação (verifyOtp recovery) e segue para /auth/reset", () => {
  const p = ler("src/app/auth/reset/codigo/page.tsx");
  assert.match(p, /verifyOtp\(\{ email: email\.trim\(\)\.toLowerCase\(\), token, type: "recovery" \}\)/);
  assert.match(p, /router\.push\("\/auth\/reset"\)/);
  assert.ok(codigoRecuperacaoValido("123456"));
  for (const x of ["12345", "1234567", "12a456", ""]) assert.ok(!codigoRecuperacaoValido(x), x);
});
