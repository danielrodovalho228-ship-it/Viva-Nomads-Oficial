/* E674 — a porta de QA não deixa a sessão da conta anterior para trás no servidor.
   Roda: node --test src/lib/qa/e674-porta-limpa-sessao.test.ts */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fonte = readFileSync("src/lib/qa/entrar-servidor.ts", "utf8");

test("antes de gravar a sessão nova, a porta encerra LOCALMENTE a sessão guardada nos cookies (sem derrubar a conta em outros aparelhos)", () => {
  const i = fonte.indexOf("verifyOtp(");
  assert.ok(i > 0);
  const antes = fonte.slice(0, i);
  assert.match(antes, /signOut\(\{ scope: "local" \}\)/);
  assert.ok(antes.lastIndexOf('signOut({ scope: "local" })') > antes.lastIndexOf("createClient()"));
});

test("a sessão só é encerrada depois de a conta passar por todas as travas (nada de limpar cookie de quem foi recusado)", () => {
  const trava = fonte.indexOf('situacaoLimite(chaveLimiteConta(email)');
  const limpa = fonte.indexOf('signOut({ scope: "local" })');
  assert.ok(trava > 0 && limpa > trava);
  assert.doesNotMatch(fonte, /signOut\(\{ scope: "global" \}\)/);
});
