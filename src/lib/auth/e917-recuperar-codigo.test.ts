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

/*
  E917 — prova ao vivo de 19/11 (ORDEM-DUET-185): o código NÃO aparecia na tela. A opção A vive dessa exibição; a caixa
  de teste pede sessão e quem esqueceu a senha não a tem. Ponto cego da T1680: lia o código direto do banco
  (emails_teste) e nunca olhava a tela. Estes testes ficam vermelhos sem a correção.
*/
import { CHAVE_CODIGO_TELA, codigoParaTela, guardarCodigoTela, VALIDADE_CODIGO_TELA_MS } from "./recuperar-codigo.ts";

test("E917 (prova 19/11) — a rota devolve o código à conta de teste; a tela de /auth/reset/codigo mostra-o", () => {
  const rota = ler("src/app/api/auth/recuperar/route.ts");
  assert.match(rota, /return NextResponse\.json\(\{ ok: true, porCodigo: true, codigo \}/);
  // Só depois do filtro is_teste: a conta real sai antes, sem código.
  assert.ok(rota.indexOf("porCodigo: false") < rota.indexOf("porCodigo: true, codigo"));
  const auth = ler("src/app/auth/page.tsx");
  assert.match(auth, /sessionStorage\.setItem\(CHAVE_CODIGO_TELA, guardarCodigoTela\(email, r\.codigo, Date\.now\(\)\)\)/);
  assert.doesNotMatch(auth, /reset\/codigo\?[^`]*codigo=/, "o código nunca vai na URL");
  const tela = ler("src/app/auth/reset/codigo/page.tsx");
  assert.match(tela, /data-testid="reset-codigo-valor">\{codigoNaTela\}/);
  assert.match(tela, /codigoParaTela\(guardado, e, Date\.now\(\)\)/);
});

test("E917 (prova 19/11) — o código guardado só aparece para o mesmo e-mail, com 6 dígitos e dentro de 10 minutos", () => {
  const agora = 1_000_000;
  const g = guardarCodigoTela("Inquilino2@VivaNomads.com.br", "482913", agora);
  assert.equal(codigoParaTela(g, "inquilino2@vivanomads.com.br", agora + 1000), "482913");
  assert.equal(codigoParaTela(g, "outra@vivanomads.com.br", agora), null);
  assert.equal(codigoParaTela(g, "inquilino2@vivanomads.com.br", agora + VALIDADE_CODIGO_TELA_MS + 1), null);
  assert.equal(codigoParaTela(guardarCodigoTela("a@b.co", "12ab56", agora), "a@b.co", agora), null);
  assert.equal(codigoParaTela("{x", "a@b.co", agora), null);
  assert.equal(codigoParaTela(null, "a@b.co", agora), null);
  assert.equal(CHAVE_CODIGO_TELA, "vn-recuperar-codigo");
});
