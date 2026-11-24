/*
  E674 (resíduo): carga completa DIRETA de /dashboard/contratos mandou 1x para /auth com a sessão viva. Causa provável (leitura
  do código; não reproduzida ao vivo): na carga completa o AuthProvider chama getSession() e, se ela devolve "sem sessão" por um
  instante (renovação do token em curso, duas abas), hydrate(null) chama setUser(null): apaga o usuário persistido e marca
  authChecked — e o AuthGuard redireciona. A navegação interna não refaz essa leitura, por isso "a mesma lista abre".
  Regra: antes de declarar "deslogado", confere uma vez com getUser() (validado no servidor) e relê a sessão.
  Roda: node --test src/lib/sessao/e674-carga-direta-sem-sessao-transitoria.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const src = readFileSync(new URL("../../components/auth-provider.tsx", import.meta.url), "utf8");

test("getSession sem sessão não vira deslogado direto: confere com getUser() e relê antes de hydrate(null)", () => {
  const i = src.indexOf("supabase.auth.getSession()");
  assert.ok(i > 0);
  const trecho = src.slice(i, i + 1200);
  assert.match(trecho, /auth\.getUser\(\)/, "confere no servidor antes de declarar deslogado");
  assert.ok(trecho.indexOf("auth.getUser()") < trecho.indexOf("hydrate(sessao)"), "a conferência vem antes do hydrate");
  assert.match(trecho, /getSession\(\)/);
  assert.match(trecho, /setAuthChecked\(true\)/);
});

test("a conferência é tolerante: uma falha de rede não derruba a carga nem vira exceção solta", () => {
  const i = src.indexOf("supabase.auth.getSession()");
  assert.match(src.slice(i, i + 1200), /catch/);
});

test("o AuthGuard continua redirecionando só com authChecked e sem usuário (sem sessão real, vai para /auth)", () => {
  const guard = readFileSync(new URL("../../components/layout/auth-guard.tsx", import.meta.url), "utf8");
  // E793 (asserção alterada): o redirecionamento lê o usuário do STORE (a conferência do cliente) — o nome mudou de
  // `user` para `storeUser`, porque `user` passou a ser o do quadro (servidor ou store, regra do A6).
  assert.match(guard, /if \(hydrated && authChecked && !storeUser\) router\.replace\("\/auth"\)/);
});
