import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** F2 (ordem d90cbe91, item 4): a mensagem do cadastro tem de ser achável e anunciada na tela. */
const fonte = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("o erro do formulário de /auth é um alerta com data-testid estável", () => {
  assert.match(fonte, /\{error && \(\s*<p role="alert" data-testid="auth-erro"/);
});

test("o cadastro mostra o erro da validação de e-mail do servidor", () => {
  assert.match(fonte, /setError\(ver\.error \|\| MSG_EMAIL_INUTILIZAVEL\)/);
});
