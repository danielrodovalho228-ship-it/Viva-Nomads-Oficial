import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { agruparChave, urlOtpauth } from "./chave-totp.ts";

test("agruparChave: grupos de 4, maiúsculas, ignora espaços", () => {
  assert.equal(agruparChave("jbswy3dpehpk3pxp"), "JBSW Y3DP EHPK 3PXP");
  assert.equal(agruparChave(" abcd efgh i "), "ABCD EFGH I");
  assert.equal(agruparChave(""), "");
});

test("urlOtpauth: esquema otpauth://totp com segredo e emissor", () => {
  const u = urlOtpauth("JBSWY3DPEHPK3PXP");
  assert.equal(u, "otpauth://totp/Viva%20Nomads?secret=JBSWY3DPEHPK3PXP&issuer=Viva%20Nomads");
});

test("urlOtpauth: segredo inválido (caracteres fora de base32) não gera link", () => {
  assert.equal(urlOtpauth("abc&issuer=evil"), null);
  assert.equal(urlOtpauth(""), null);
});

test("tela: chave em texto, copiar e link do app antes do QR; ações empilhadas", () => {
  const src = readFileSync("src/components/seguranca/duas-etapas.tsx", "utf8");
  assert.match(src, /Copiar código/);
  assert.match(src, /Abrir no app autenticador/);
  assert.match(src, /navigator\.clipboard/);
  assert.ok(src.indexOf("Abrir no app autenticador") < src.indexOf("alt=\"QR code"), "link antes do QR");
  assert.doesNotMatch(src, /console\.(log|info|debug)/);
});
