/*
  Login social no app (ordem 1f65c73d): state assinado de 5 min e caminho de retorno ao app.
  Roda: node --test src/lib/app/login-social.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  codigoValido,
  conferirStateLogin,
  emitirStateLogin,
  provedorValido,
  segredoLoginApp,
  urlRetornoApp,
  VALIDADE_STATE_S,
} from "./login-social.ts";

const SEGREDO = "segredo-de-teste";
const AGORA = new Date("2026-10-09T12:00:00Z");

test("provedor: só google e apple", () => {
  assert.equal(provedorValido("google"), "google");
  assert.equal(provedorValido("apple"), "apple");
  for (const ruim of ["facebook", "", null, 3, "GOOGLE"]) assert.equal(provedorValido(ruim), null, String(ruim));
});

test("state emitido vale 5 min para o mesmo provedor", () => {
  const s = emitirStateLogin("google", AGORA, SEGREDO)!;
  assert.ok(s);
  assert.equal(conferirStateLogin(s.state, "google", new Date(AGORA.getTime() + (VALIDADE_STATE_S - 1) * 1000), SEGREDO), s.nonce);
});

test("caso negativo: expirado, outro provedor, outro segredo, adulterado, sem segredo", () => {
  const s = emitirStateLogin("google", AGORA, SEGREDO)!;
  assert.equal(conferirStateLogin(s.state, "google", new Date(AGORA.getTime() + (VALIDADE_STATE_S + 1) * 1000), SEGREDO), null);
  assert.equal(conferirStateLogin(s.state, "apple", AGORA, SEGREDO), null);
  assert.equal(conferirStateLogin(s.state, "google", AGORA, "outro"), null);
  const [n, e, a] = s.state.split(".");
  assert.equal(conferirStateLogin(`${n}.${Number(e) + 600}.${a}`, "google", AGORA, SEGREDO), null);
  assert.equal(conferirStateLogin("lixo", "google", AGORA, SEGREDO), null);
  assert.equal(conferirStateLogin(null, "google", AGORA, SEGREDO), null);
  assert.equal(emitirStateLogin("google", AGORA, ""), null);
  assert.equal(conferirStateLogin(s.state, "google", AGORA, ""), null);
});

test("segredo: LOGIN_APP_SEGREDO > PONTE_APP_SEGREDO > service role", () => {
  assert.equal(segredoLoginApp({ LOGIN_APP_SEGREDO: "a", PONTE_APP_SEGREDO: "b", SUPABASE_SERVICE_ROLE_KEY: "c" }), "a");
  assert.equal(segredoLoginApp({ PONTE_APP_SEGREDO: "b", SUPABASE_SERVICE_ROLE_KEY: "c" }), "b");
  assert.equal(segredoLoginApp({ SUPABASE_SERVICE_ROLE_KEY: "c" }), "c");
  assert.equal(segredoLoginApp({}), "");
});

test("código PKCE: formato seguro; deep link de volta codifica code e state", () => {
  assert.equal(codigoValido("abc12345-XYZ_def.~"), true);
  for (const ruim of ["curto", "tem espaço aqui", "a&b=c-12345", "x".repeat(301), null, 5]) assert.equal(codigoValido(ruim), false, String(ruim));
  assert.equal(urlRetornoApp("abc12345", "n.1.s"), "vivanomads://auth/callback?code=abc12345&state=n.1.s");
});

test("rota: a ponte não troca code por sessão, consome o state uma vez e a página manda postMessage no app", () => {
  const rota = readFileSync(new URL("../../app/auth/app-callback/route.ts", import.meta.url), "utf8");
  assert.ok(!/exchangeCodeForSession/.test(rota));
  assert.ok(/consumirLimite\(`login-social-uso:\$\{nonce\}`, 1,/.test(rota));
  const pagina = readFileSync(new URL("../../app/auth/page.tsx", import.meta.url), "utf8");
  assert.ok(/tipo: "login-social"/.test(pagina) && /skipBrowserRedirect: true/.test(pagina));
  assert.ok(/LOGIN_APPLE_ATIVO/.test(pagina));
});
