import { test } from "node:test";
import assert from "node:assert/strict";
import { dominioCorporativo } from "./dominio-corporativo.ts";

test("aceita domínio de empresa, hospital e universidade e devolve só o domínio", () => {
  assert.deepEqual(dominioCorporativo("Ana.Souza@Empresa.com.br"), { ok: true, dominio: "empresa.com.br" });
  assert.deepEqual(dominioCorporativo("x@hc.ufu.br"), { ok: true, dominio: "hc.ufu.br" });
});

test("recusa provedores gratuitos (gmail, hotmail, outlook, yahoo, icloud, uol, bol)", () => {
  for (const d of ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br", "icloud.com", "uol.com.br", "bol.com.br", "live.com", "proton.me"]) {
    assert.equal(dominioCorporativo(`a@${d}`).ok, false, d);
  }
});

test("recusa e-mail inválido ou vazio", () => {
  for (const v of ["", "semarroba", "a@", "@b.com", "a@b", "a b@c.com", null, undefined]) {
    assert.equal(dominioCorporativo(v as string).ok, false, String(v));
  }
});
