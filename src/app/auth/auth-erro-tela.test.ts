import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** F2 (ordem d90cbe91, item 4): a mensagem do cadastro tem de ser achável e anunciada na tela. */
const fonte = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("o erro do formulário de /auth é um alerta com data-testid estável", () => {
  assert.match(fonte, /\{error && \(\s*<p role="alert" data-testid="auth-erro"/);
});

test("a entrada única mostra o erro da validação de e-mail do servidor (Prompt 49: a conta nasce no código)", () => {
  const rota = readFileSync(new URL("../api/auth/codigo/route.ts", import.meta.url), "utf8");
  assert.match(rota, /dominioBarrado\(dominio, simuladas\) \|\| !\(await dominioExiste\(dominio, simuladas \? resolvedorLab : undefined\)\)/);
  // O resolvedor simulado só entra com as integrações simuladas (que nunca valem em produção).
  assert.match(rota, /const simuladas = integracoesSimuladas\(\);/);
  assert.match(rota, /error: MSG_EMAIL_INUTILIZAVEL/);
  const tela = readFileSync(new URL("../../components/auth/login-por-codigo.tsx", import.meta.url), "utf8");
  assert.match(tela, /setErro\(r\.error \|\|/);
  assert.match(tela, /\{erro && \(\s*<p role="alert" data-testid="auth-erro"/);
});
