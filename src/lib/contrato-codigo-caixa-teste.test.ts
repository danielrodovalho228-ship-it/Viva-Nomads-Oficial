import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem d07e4c70: o código de assinatura precisa chegar à caixa de e-mails de teste (só conta is_teste),
// senão o laboratório não consegue assinar pela tela sem ler caixa de e-mail real.
const fonte = readFileSync("src/lib/data/contrato-assinar-actions.ts", "utf8");

test("pedirCodigoAssinatura guarda o código na caixa de teste, só depois do envio e só da própria conta", () => {
  const ini = fonte.indexOf("export async function pedirCodigoAssinatura");
  const fim = fonte.indexOf("export async function assinarContrato");
  const corpo = fonte.slice(ini, fim);
  const envio = corpo.indexOf("await sendEmail(");
  const guarda = corpo.indexOf("guardarSeContaDeTeste(");
  assert.ok(envio > 0 && guarda > envio, "guardarSeContaDeTeste vem depois do sendEmail");
  assert.match(corpo, /usuarioId:\s*user\.id/, "grava só para a conta logada");
  assert.match(corpo, /para:\s*user\.email/);
  assert.ok(corpo.indexOf("if (r.error)") < guarda, "não guarda se o envio falhou");
});
