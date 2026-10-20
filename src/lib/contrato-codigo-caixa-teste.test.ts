import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem d07e4c70: o código de assinatura precisa chegar à caixa de e-mails de teste (só conta is_teste),
// senão o laboratório não consegue assinar pela tela sem ler caixa de e-mail real.
const fonte = readFileSync("src/lib/data/contrato-assinar-actions.ts", "utf8");

test("pedirCodigoAssinatura: o código vai para a caixa de teste pelo sendEmail (depois do envio aceito), só da própria conta", () => {
  const ini = fonte.indexOf("export async function pedirCodigoAssinatura");
  const fim = fonte.indexOf("export async function assinarContrato");
  const corpo = fonte.slice(ini, fim);
  // Complemento do #880: a gravação é uma só, dentro do sendEmail (email.ts), depois do id do Resend.
  assert.doesNotMatch(corpo, /guardarSeContaDeTeste\(/);
  const envio = corpo.slice(corpo.indexOf("await sendEmail("), corpo.indexOf("if (r.error)"));
  assert.match(envio, /to:\s*user\.email/);
  assert.match(envio, /evento: "contract_signature_code",\s*usuarioId: user\.id,/, "grava só para a conta logada");
});
