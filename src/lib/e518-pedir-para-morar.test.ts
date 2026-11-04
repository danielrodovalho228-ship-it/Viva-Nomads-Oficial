/*
  E518 (GRAVE) — "Pedir para morar" sem botão de enviar.
  Causa: no anúncio de teste, o botão fica desativado enquanto o perfil (is_teste) não chega (aguardandoPerfil). A leitura
  do perfil no AuthProvider só tratava EXCEÇÃO; o Supabase DEVOLVE o erro (não lança), então uma leitura falha marcava o
  perfil como lido, nunca tentava de novo e o isTeste ficava undefined PARA SEMPRE — o botão nunca liberava e a janela
  com "Enviar candidatura" nunca abria. Sem linha de perfil, idem.
  Correção: erro → tenta de novo (até 2 vezes); sem linha, ou depois das tentativas, o isTeste resolve (false = visitante,
  com a faixa explicando), nunca fica "carregando" eterno.
  Roda: node --test src/lib/e518-pedir-para-morar.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");

test("AuthProvider: erro na leitura do perfil é tratado (não só exceção) e tenta de novo", () => {
  const a = ler("src/components/auth-provider.tsx");
  assert.match(a, /\{ data: profile, error: erroPerfil \}/);
  assert.match(a, /if \(erroPerfil\) \{/);
  assert.match(a, /perfilLido\.delete\(u\.id\);/);
  assert.match(a, /setTimeout\(\(\) => void hydrate\(session, true, tentativa \+ 1\), /);
  assert.match(a, /tentativa < TENTATIVAS_PERFIL/);
});

test("AuthProvider: sem linha de perfil ou sem leitura depois das tentativas, isTeste resolve (nunca fica undefined)", () => {
  const a = ler("src/components/auth-provider.tsx");
  assert.match(a, /function resolverIsTeste\(/);
  assert.match(a, /isTeste === undefined\) setUser\(\{ \.\.\.agora, isTeste: false \}\)/);
  assert.ok((a.match(/resolverIsTeste\(u\.id\)/g) ?? []).length >= 2, "sem linha e depois das tentativas");
});

test("anúncio: o botão só espera enquanto isTeste é undefined (a regra que o AuthProvider agora sempre resolve)", () => {
  const d = ler("src/app/(public)/imoveis/[id]/property-detail.tsx");
  assert.match(d, /const aguardandoPerfil = modoTeste === "visitante" && \(!authChecked \|\| \(!!usuario && usuario\.isTeste === undefined\)\);/);
  assert.match(d, /Enviar candidatura/);
});
