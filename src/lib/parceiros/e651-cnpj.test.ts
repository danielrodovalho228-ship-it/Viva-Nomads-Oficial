/*
  E651 — a recusa do CPF no formulário público de parceiro NÃO disparava: o botão "Continuar: criar conta ou entrar" ia
  para o login ANTES de validar o documento. Agora o documento é validado no passo (14 dígitos + dígitos verificadores de
  CNPJ) com mensagem clara ANTES de avançar; o servidor continua recusando (validarSolicitacao).
  (A pendência de CNPJ no painel de PF já publicado — E650 — é do PR #3013.)
  Roda: node --test src/lib/parceiros/e651-e650-cnpj.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG_SO_CNPJ, erroDocumentoParceiro, validarSolicitacao } from "./regras.ts";

const CNPJ_OK = "11.222.333/0001-81";
const CPF_OK = "529.982.247-25";

test("erroDocumentoParceiro: vazio, CPF, incompleto, dígito errado e CNPJ válido", () => {
  assert.match(erroDocumentoParceiro("")!, /Informe o CNPJ/);
  assert.equal(erroDocumentoParceiro(CPF_OK), MSG_SO_CNPJ, "CPF completo: recusa clara de CPF");
  assert.equal(erroDocumentoParceiro("52998224725"), MSG_SO_CNPJ, "CPF só com dígitos");
  assert.match(erroDocumentoParceiro("11.222.333/0001")!, /14 números/, "CNPJ incompleto");
  assert.match(erroDocumentoParceiro("11.222.333/0001-80")!, /inválido/i, "dígito verificador errado");
  assert.equal(erroDocumentoParceiro(CNPJ_OK), null);
  assert.equal(erroDocumentoParceiro("11222333000181"), null);
});

test("CPF parcial (11 dígitos mutilado pela máscara) também recusa com a mensagem de CPF quando for um CPF válido", () => {
  assert.equal(erroDocumentoParceiro("529.982.247-2"), "CNPJ incompleto: informe os 14 números do CNPJ da empresa.");
});

const form = readFileSync(new URL("../../components/parceiros/seja-parceiro-form.tsx", import.meta.url), "utf8");

test("formulário: valida o documento ANTES de mandar para a conta (deslogado) e mostra a recusa", () => {
  const fn = form.slice(form.indexOf("function enviar("), form.indexOf("iniciar(async"));
  const iDoc = fn.indexOf("erroDocumentoParceiro(c.documento)");
  const iConta = fn.indexOf("irParaConta()");
  assert.ok(iDoc > -1, "chama a validação do documento");
  assert.ok(iConta > -1 && iDoc < iConta, "a validação vem antes de avançar para a conta");
  assert.match(fn, /setErroDocumento\(erroDoc\)/);
  assert.match(fn, /estado\.logado \|\| c\.documento\.trim\(\) \? erroDocumentoParceiro\(c\.documento\) : null/, "visitante com o campo vazio segue para a conta (o documento é pedido na volta)");
  assert.match(form, /data-testid="sp-doc-erro"/);
});

test("servidor segue recusando CPF e CNPJ inválido", () => {
  const base = { nome: "Maria Silva", tipoPessoa: "pj" as const, categorias: ["limpeza"], cidades: ["Uberlândia"], descricao: "x".repeat(40), telefone: "", dadosCategoria: {} };
  const cpf = validarSolicitacao({ ...base, documento: CPF_OK } as never);
  assert.equal(cpf.ok, false);
  const ruim = validarSolicitacao({ ...base, documento: "11222333000180" } as never);
  assert.equal(ruim.ok, false);
});
