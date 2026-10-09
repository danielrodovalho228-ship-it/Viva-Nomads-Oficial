/*
  Ponte app → navegador (bc09134e, parte 1): token de uso único, 60 s, amarrado ao usuário e ao destino.
  Roda: node --test src/lib/app/ponte.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { conferirTokenPonte, destinoPonteValido, emitirTokenPonte, VALIDADE_PONTE_S } from "./ponte.ts";

const SEGREDO = "segredo-de-teste";
const AGORA = new Date("2026-10-09T12:00:00Z");
const DESTINO = "/dashboard/assinatura";

test("destino: só caminho interno da lista; externo, '//', esquema e outras telas são recusados", () => {
  assert.equal(destinoPonteValido("/dashboard/assinatura"), "/dashboard/assinatura");
  assert.equal(destinoPonteValido("/dashboard/assinatura?plano=pro"), "/dashboard/assinatura?plano=pro");
  for (const ruim of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "/admin", "/dashboard", "/dashboard/assinaturaX", "", null, 5]) {
    assert.equal(destinoPonteValido(ruim), null, String(ruim));
  }
});

test("token emitido vale para o mesmo usuário e destino, dentro de 60 s", () => {
  const t = emitirTokenPonte("user-1", DESTINO, AGORA, SEGREDO);
  assert.ok(t);
  assert.equal(t.expira - Math.floor(AGORA.getTime() / 1000), VALIDADE_PONTE_S);
  assert.equal(conferirTokenPonte(t.token, "user-1", DESTINO, new Date(AGORA.getTime() + 59_000), SEGREDO), t.nonce);
});

test("caso negativo: expirado, outro usuário, outro destino, outro segredo e adulterado", () => {
  const t = emitirTokenPonte("user-1", DESTINO, AGORA, SEGREDO)!;
  const depois = new Date(AGORA.getTime() + 61_000);
  assert.equal(conferirTokenPonte(t.token, "user-1", DESTINO, depois, SEGREDO), null);
  assert.equal(conferirTokenPonte(t.token, "user-2", DESTINO, AGORA, SEGREDO), null);
  assert.equal(conferirTokenPonte(t.token, "user-1", "/dashboard/assinatura/x", AGORA, SEGREDO), null);
  assert.equal(conferirTokenPonte(t.token, "user-1", DESTINO, AGORA, "outro"), null);
  const [n, e, s] = t.token.split(".");
  assert.equal(conferirTokenPonte(`${n}.${Number(e) + 600}.${s}`, "user-1", DESTINO, AGORA, SEGREDO), null);
  assert.equal(conferirTokenPonte("lixo", "user-1", DESTINO, AGORA, SEGREDO), null);
});

test("não emite para destino inválido nem sem segredo; cada token tem nonce próprio", () => {
  assert.equal(emitirTokenPonte("user-1", "https://evil.com", AGORA, SEGREDO), null);
  assert.equal(emitirTokenPonte("user-1", DESTINO, AGORA, ""), null);
  const a = emitirTokenPonte("user-1", DESTINO, AGORA, SEGREDO)!;
  const b = emitirTokenPonte("user-1", DESTINO, AGORA, SEGREDO)!;
  assert.notEqual(a.nonce, b.nonce);
});

test("rota: exige login, valida destino, limita taxa e nunca registra o token", () => {
  const src = readFileSync("src/app/api/app/ponte/route.ts", "utf8");
  assert.match(src, /401/);
  assert.match(src, /destinoPonteValido/);
  assert.match(src, /consumirLimite/);
  assert.doesNotMatch(src, /console\.(log|error|warn)/);
});
