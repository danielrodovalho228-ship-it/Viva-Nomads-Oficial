/*
  E651 — a recusa do CPF no cadastro de parceiro não disparava: o formulário mandava a pessoa deslogada para /auth
  ANTES de conferir o documento, então um CPF digitado avançava sem nenhuma mensagem. Correção: o documento é conferido
  no passo (14 dígitos + dígitos verificadores) ANTES de avançar, e o servidor recusa pelo mesmo critério.
  Roda: node --test src/lib/parceiros/e651-recusa-documento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG_SO_CNPJ, validarDocumentoParceiro, validarSolicitacao } from "./regras.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("CPF (válido, formatado ou com 11 dígitos quaisquer) é recusado com a mensagem do CNPJ", () => {
  assert.equal(validarDocumentoParceiro("529.982.247-25"), MSG_SO_CNPJ);
  assert.equal(validarDocumentoParceiro("52998224725"), MSG_SO_CNPJ);
  assert.equal(validarDocumentoParceiro("123.456.789-00"), MSG_SO_CNPJ, "11 dígitos é tentativa de CPF, valide ou não");
});
test("CNPJ incompleto ou com dígito verificador errado é recusado com mensagem própria", () => {
  assert.match(validarDocumentoParceiro("11.222.333/0001") ?? "", /14 dígitos/);
  assert.match(validarDocumentoParceiro("") ?? "", /14 dígitos/);
  assert.match(validarDocumentoParceiro("11.222.333/0001-82") ?? "", /CNPJ inválido/);
});
test("CNPJ válido passa (null)", () => {
  assert.equal(validarDocumentoParceiro("11.222.333/0001-81"), null);
});
test("o servidor usa o mesmo critério (validarSolicitacao recusa o CPF e o CNPJ errado)", () => {
  const base = { nome: "Maria Limpezas", tipoPessoa: "pj" as const, categorias: ["limpeza"], cidades: ["Uberlândia"], descricao: "Limpeza pós-obra", emiteNota: true, aceite: true };
  assert.deepEqual(validarSolicitacao({ ...base, documento: "529.982.247-25" }), { ok: false, erro: MSG_SO_CNPJ, campo: "documento" });
  assert.equal(validarSolicitacao({ ...base, documento: "11.222.333/0001-81" }).ok, true);
  assert.match(ler("lib/parceiros/solicitacao-actions.ts"), /validarSolicitacao\(/);
});
test("o formulário confere o documento ANTES de mandar a pessoa deslogada para o /auth", () => {
  const f = ler("components/parceiros/seja-parceiro-form.tsx");
  const i = f.indexOf("function enviar(");
  const corpo = f.slice(i, f.indexOf("return (", i));
  const iDoc = corpo.indexOf("validarDocumentoParceiro(");
  const iAuth = corpo.indexOf("irParaConta()");
  assert.ok(iDoc > -1, "o passo valida o documento");
  assert.ok(iAuth > -1 && iDoc < iAuth, "a validação vem antes de ir para a conta");
});
