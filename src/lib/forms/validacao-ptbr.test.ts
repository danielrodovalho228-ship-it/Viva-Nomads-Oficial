import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mensagemValidacaoPtBr, type CampoValidavel } from "./validacao-ptbr.ts";

const ok = { valueMissing: false, typeMismatch: false, tooShort: false, tooLong: false, patternMismatch: false, rangeUnderflow: false, rangeOverflow: false, stepMismatch: false, badInput: false };
const campo = (p: Partial<CampoValidavel> & { falha?: Partial<typeof ok> }): CampoValidavel => ({ type: "text", tagName: "INPUT", ...p, validity: { ...ok, ...p.falha } });

test("E384 — cada falha da validação nativa tem a sua mensagem em português", () => {
  assert.equal(mensagemValidacaoPtBr(campo({ falha: { valueMissing: true } })), "Preencha este campo.");
  assert.equal(mensagemValidacaoPtBr(campo({ type: "checkbox", falha: { valueMissing: true } })), "Marque esta opção para continuar.");
  assert.equal(mensagemValidacaoPtBr(campo({ type: "select-one", tagName: "SELECT", falha: { valueMissing: true } })), "Escolha uma opção da lista.");
  assert.equal(mensagemValidacaoPtBr(campo({ type: "email", falha: { typeMismatch: true } })), "Informe um e-mail válido (ex.: nome@exemplo.com).");
  assert.equal(mensagemValidacaoPtBr(campo({ type: "url", falha: { typeMismatch: true } })), "Informe um link válido, começando com https://.");
  assert.equal(mensagemValidacaoPtBr(campo({ minLength: 8, falha: { tooShort: true } })), "Use pelo menos 8 caracteres.");
  assert.equal(mensagemValidacaoPtBr(campo({ title: "Use 8 dígitos do CEP", falha: { patternMismatch: true } })), "Use 8 dígitos do CEP");
  assert.equal(mensagemValidacaoPtBr(campo({ type: "number", min: "1", falha: { rangeUnderflow: true } })), "O valor mínimo é 1.");
  assert.equal(mensagemValidacaoPtBr(campo({})), null);
  for (const k of Object.keys(ok)) assert.doesNotMatch(String(mensagemValidacaoPtBr(campo({ falha: { [k]: true } }))), /Please|field|valid value/i, k);
});

test("E384 — vale para todas as telas (montado na raiz) e nunca prende um campo já corrigido", () => {
  const raiz = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");
  assert.match(raiz, /<ValidacaoPtBr \/>/);
  const c = readFileSync(new URL("../../components/forms/validacao-ptbr.tsx", import.meta.url), "utf8");
  assert.match(c, /document\.addEventListener\("invalid", aoInvalidar, true\);/);
  assert.match(c, /document\.addEventListener\("click", antesDeTentar, true\);/);
  assert.match(c, /if \(c\.validity\.customError && !nossas\.has\(c\)\) return;/, "mensagem própria de outro código é respeitada");
});
