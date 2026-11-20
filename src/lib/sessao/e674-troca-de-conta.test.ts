/*
  E674 (07/11, retomada do E652): logado como proprietario2 (Paulo) pela porta de QA, navegar a /dashboard ou
  /dashboard/conta restaurou a sessão anterior do inquilino1 (Lucas). Duas causas no código:
  (1) o modo ativo e o papel "parceiro" ficam no navegador (localStorage, "vivanomads-auth") e eram herdados pela conta
      seguinte — Paulo abria como o Lucas (morador);
  (2) a página da porta de QA mantém o cliente do navegador com a sessão da conta anterior; ele podia renovar o token e
      regravar o cookie dela depois que o servidor gravou o da conta nova.
  Roda: node --test src/lib/sessao/e674-troca-de-conta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadoAoTrocarDeConta } from "./troca-de-conta.ts";

const ler = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

test("E674: outra conta no mesmo navegador não herda o modo nem o papel parceiro da anterior", () => {
  assert.deepEqual(estadoAoTrocarDeConta("lucas", "paulo"), { trocou: true, activeMode: null, parceiroAtivo: false });
});

test("E674: a mesma conta (ou o primeiro login) mantém o que está guardado", () => {
  assert.deepEqual(estadoAoTrocarDeConta("lucas", "lucas"), { trocou: false });
  assert.deepEqual(estadoAoTrocarDeConta(null, "paulo"), { trocou: false });
  assert.deepEqual(estadoAoTrocarDeConta("lucas", null), { trocou: false });
});

test("E674: o store aplica a regra ao trocar de usuário", () => {
  const store = ler("lib/store.ts");
  assert.match(store, /estadoAoTrocarDeConta\(/);
  const setUser = store.slice(store.indexOf("setUser: (user) => {"), store.indexOf("setActiveMode: (activeMode)"));
  assert.match(setUser, /parceiroAtivo/);
  assert.match(setUser, /sessionStartedAt: Date\.now\(\)/);
});

test("E674: a porta de QA encerra a sessão local do navegador antes de pedir a nova", () => {
  const form = ler("app/qa/entrar/qa-entrar-form.tsx");
  const antes = form.slice(0, form.indexOf('fetch("/api/qa/entrar"'));
  assert.match(antes, /signOut\(\{ scope: "local" \}\)/);
  assert.match(antes, /useAuthStore\.getState\(\)\.signOut\(\)/);
});
