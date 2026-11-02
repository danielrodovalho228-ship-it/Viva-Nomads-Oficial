/*
  Varredura de títulos a 390 px (02/11, Pista A): a tela de entrar (e /pedidos, que leva a ela sem login) ficava sem h1 no
  celular — o único h1 morava no cartaz da foto, que só aparece do lg para cima. Agora o h1 é o título do formulário
  (todas as larguras): "Entre ou crie sua conta" / "Digite o código", "Entrar com senha", "Recuperar senha". A frase do
  cartaz ("Bem-vindo de volta.") vira texto com o mesmo desenho.
  Roda: npm test
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("o título do formulário é o h1 em todas as larguras", () => {
  const auth = ler("src/app/auth/page.tsx");
  assert.match(auth, /<h1 className="mt-6 font-title text-2xl font-semibold text-ink">Entrar com senha<\/h1>/);
  assert.match(auth, /<h1 className="mt-6 font-title text-2xl font-semibold text-ink">Recuperar senha<\/h1>/);
  assert.match(ler("src/components/auth/login-por-codigo.tsx"), /<h1 className="mt-6 font-title text-2xl font-semibold text-ink">\{enviado \? "Digite o código" : "Entre ou crie sua conta"\}<\/h1>/);
});

test("o cartaz da foto (só no computador) não tem h1 — a frase é texto, com o mesmo desenho", () => {
  const auth = ler("src/app/auth/page.tsx");
  assert.match(auth, /<p className="font-title text-\[28px\] font-semibold leading-tight" data-testid="porta-titulo-foto">/);
  assert.equal((auth.match(/<h1\b/g) ?? []).length, 2, "dois h1 no arquivo, um por formulário (só um aparece por vez)");
});
