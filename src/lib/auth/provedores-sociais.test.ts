/*
  LOGIN-APPLE: quais botões sociais a entrada mostra, com a flag da Apple desligada (padrão) e ligada.
  Roda: node --test src/lib/auth/provedores-sociais.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROTULO_APPLE, provedoresSociais } from "./provedores-sociais.ts";

const ler = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

test("flag da Apple desligada: a lista é a de hoje (só o Google quando ele está ligado)", () => {
  assert.deepEqual(provedoresSociais({ google: true, apple: false }), ["google"]);
  assert.deepEqual(provedoresSociais({ google: false, apple: false }), []);
});

test("flag da Apple ligada: a Apple aparece e vem primeiro", () => {
  assert.deepEqual(provedoresSociais({ google: true, apple: true }), ["apple", "google"]);
  assert.deepEqual(provedoresSociais({ google: false, apple: true }), ["apple"]);
});

test("a flag nasce desligada: só liga com NEXT_PUBLIC_LOGIN_APPLE_ATIVO=\"on\"", () => {
  const flags = ler("lib/flags.ts");
  assert.match(flags, /export const LOGIN_APPLE_ATIVO = process\.env\.NEXT_PUBLIC_LOGIN_APPLE_ATIVO === "on";/);
  assert.match(ler("config/chaves-ambiente.ts"), /nome: "LOGIN_APPLE_ATIVO"[^}]*variavel: "NEXT_PUBLIC_LOGIN_APPLE_ATIVO"/);
});

test("a entrada usa a lista pura e o botão da Apple; o clique continua travado pela flag", () => {
  const pagina = ler("app/auth/page.tsx");
  assert.match(pagina, /provedoresSociais\(\{ google: LOGIN_GOOGLE_ATIVO, apple: LOGIN_APPLE_ATIVO \}\)/);
  assert.match(pagina, /<BotaoApple key=\{p\} disabled=\{loading\} onClick=\{\(\) => handleSocial\("apple"\)\} \/>/);
  assert.match(pagina, /if \(provedor === "google" \? !LOGIN_GOOGLE_ATIVO : !LOGIN_APPLE_ATIVO\) return;/);
  assert.ok(!/Continuar com Apple/.test(pagina), "o texto antigo (sem o artigo) saiu");
  // O botão do Google não mudou.
  assert.match(pagina, /<Globe className="h-4 w-4" \/> Continuar com Google/);
});

test("botão da Apple: preto (variante night), maçã sem biblioteca de ícones, texto localizado oficial", () => {
  const botao = ler("components/auth/botao-apple.tsx");
  assert.match(botao, /variant="night"/);
  assert.match(botao, /<svg aria-hidden="true"/);
  assert.match(botao, /data-testid="login-apple"/);
  assert.equal(ROTULO_APPLE, "Continuar com a Apple");
});
