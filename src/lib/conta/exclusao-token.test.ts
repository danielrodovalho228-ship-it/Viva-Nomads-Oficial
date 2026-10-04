/*
  M1 — token do link de exclusão de conta.
  Roda: node --test src/lib/conta/exclusao-token.test.ts
*/
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";

import { criarTokenExclusao, lerTokenExclusao, hashSeguro, normalizarEmail, EXCLUSAO_TTL_S } from "./exclusao-token.ts";

const S = "segredo-de-teste";
const D = { j: "pedido-1", u: "11111111-1111-1111-1111-111111111111", e: "  Joao.Silva@Hotmail.com " };

test("ida e volta: devolve pedido, uid e e-mail normalizado", () => {
  const t = lerTokenExclusao(criarTokenExclusao(D, S), S);
  assert.equal(t?.j, "pedido-1");
  assert.equal(t?.u, D.u);
  assert.equal(t?.e, "joao.silva@hotmail.com");
});

test("vale 30 minutos e expira depois", () => {
  assert.equal(EXCLUSAO_TTL_S, 1800);
  const agora = 1_000_000;
  const tok = criarTokenExclusao(D, S, agora);
  assert.ok(lerTokenExclusao(tok, S, agora + 1799));
  assert.equal(lerTokenExclusao(tok, S, agora + 1801), null);
});

test("assinatura errada, segredo errado ou payload adulterado → null", () => {
  const tok = criarTokenExclusao(D, S);
  assert.equal(lerTokenExclusao(tok, "outro-segredo"), null);
  const [p, s] = tok.split(".");
  const outro = Buffer.from(JSON.stringify({ ...D, u: "22222222-2222-2222-2222-222222222222", exp: 9e9 })).toString("base64url");
  assert.equal(lerTokenExclusao(`${outro}.${s}`, S), null);
  assert.equal(lerTokenExclusao(`${p}.${s}.extra`, S), null);
  assert.equal(lerTokenExclusao("lixo", S), null);
  assert.equal(lerTokenExclusao("", S), null);
});

test("token antigo (só e-mail, sem pedido/uid) não vale mais", () => {
  const payload = Buffer.from(JSON.stringify({ e: "a@b.com", exp: 9e9 })).toString("base64url");
  const sig = crypto.createHmac("sha256", S).update(payload).digest("base64url");
  assert.equal(lerTokenExclusao(`${payload}.${sig}`, S), null);
});

test("e-mail com _ e % é só texto: normaliza, não vira coringa", () => {
  assert.equal(normalizarEmail(" Joao_Silva@Hotmail.com "), "joao_silva@hotmail.com");
  assert.notEqual(hashSeguro("email", "joao_silva@hotmail.com", S), hashSeguro("email", "joao.silva@hotmail.com", S));
});

test("hash de e-mail e de IP não colidem entre si", () => {
  assert.notEqual(hashSeguro("email", "x", S), hashSeguro("ip", "x", S));
});
