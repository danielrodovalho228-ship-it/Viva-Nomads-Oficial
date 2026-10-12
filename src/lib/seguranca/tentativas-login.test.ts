/* Roda: node --test src/lib/seguranca/tentativas-login.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  esperaSegundos,
  exigeCaptchaPorFalhas,
  lerFalhas,
  segundosRestantes,
  MSG_LOGIN_FALHOU,
} from "./tentativas-login.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("F44: captcha só obrigatório a partir da 3ª falha", () => {
  assert.equal(exigeCaptchaPorFalhas(2), false);
  assert.equal(exigeCaptchaPorFalhas(3), true);
});

test("F44: atraso progressivo com teto de 60 s", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 9].map(esperaSegundos), [0, 0, 0, 5, 10, 20, 40, 60]);
});

test("F44: segundos restantes contam a partir da última falha", () => {
  assert.equal(segundosRestantes({ falhas: 4, ultima: 1000 }, 1000 + 3000), 7);
  assert.equal(segundosRestantes({ falhas: 4, ultima: 1000 }, 1000 + 11000), 0);
  assert.equal(segundosRestantes({ falhas: 1, ultima: 1000 }, 1000), 0);
});

test("F44: registro corrompido vira zero falhas", () => {
  assert.deepEqual(lerFalhas("lixo"), { falhas: 0, ultima: 0 });
  assert.deepEqual(lerFalhas(null), { falhas: 0, ultima: 0 });
  assert.deepEqual(lerFalhas('{"falhas":2,"ultima":5}'), { falhas: 2, ultima: 5 });
});

test("F43: a tela de login não consulta nem mostra se o e-mail existe", () => {
  const tela = ler("app/auth/page.tsx");
  assert.ok(!/email-existe/.test(tela), "não pode chamar /api/auth/email-existe");
  assert.ok(!/setSemConta|semConta/.test(tela), "não pode ter estado 'sem conta'");
  assert.ok(!/Ainda não há conta/.test(tela));
  assert.equal(MSG_LOGIN_FALHOU, "E-mail ou senha incorretos.");
});

test("F43: a rota pública email-existe deixou de existir", () => {
  assert.throws(() => ler("app/api/auth/email-existe/route.ts"));
});
