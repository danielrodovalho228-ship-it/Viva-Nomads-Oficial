import { test } from "node:test";
import assert from "node:assert/strict";
import { atendeCidade, cidadeDoCep, contatoLiberado, creditoNoCancelamento, filtrarPorCidade, normalizarCep, podeAceitar, portfolioSeguro, taxaValida, validarPedido } from "./regras.ts";

const ID = "3f2b8c1e-5a4d-4e7b-9c1a-0d2e4f6a8b10";
const base = { fotografoId: ID, cep: "38400-100", cidade: "Uberlândia", uf: "mg", data: "2026-10-20", observacao: "" };

test("busca por cidade: ignora acento e caixa, inclui quem viaja (lista de cidades)", () => {
  const lista = [{ cidades: ["Uberlândia", "Araguari"] }, { cidades: ["Goiânia"] }];
  assert.equal(atendeCidade(lista[0], "uberlandia"), true);
  assert.deepEqual(filtrarPorCidade(lista, "ARAGUARI"), [lista[0]]);
  assert.deepEqual(filtrarPorCidade(lista, "Belo Horizonte"), []);
});

test("CEP: só 8 dígitos", () => {
  assert.equal(normalizarCep("38400-100"), "38400100");
  assert.equal(normalizarCep("1234"), null);
  assert.equal(normalizarCep(null), null);
});

test("contato do dono só depois do aceite COM taxa paga", () => {
  assert.equal(contatoLiberado({ status: "enviado", taxa_paga_em: null }), false);
  assert.equal(contatoLiberado({ status: "aceito", taxa_paga_em: null }), false); // aceito sem pagar: nunca
  assert.equal(contatoLiberado({ status: "recusado", taxa_paga_em: "2026-10-11T10:00:00Z" }), false);
  assert.equal(contatoLiberado({ status: "aceito", taxa_paga_em: "2026-10-11T10:00:00Z" }), true);
});

test("só aceita depois de pagar a taxa", () => {
  assert.equal(podeAceitar({ status: "enviado", taxa_paga_em: null }), false);
  assert.equal(podeAceitar({ status: "enviado", taxa_paga_em: "2026-10-11T10:00:00Z" }), true);
  assert.equal(podeAceitar({ status: "cancelado", taxa_paga_em: "2026-10-11T10:00:00Z" }), false);
});

test("cancelamento antes do ensaio vira crédito; sem taxa paga ou após entrega, não", () => {
  const pago = "2026-10-11T10:00:00Z";
  assert.equal(creditoNoCancelamento({ status: "aceito", taxa_paga_em: pago, taxa_valor: 40 }), 40);
  assert.equal(creditoNoCancelamento({ status: "enviado", taxa_paga_em: null, taxa_valor: 40 }), 0);
  assert.equal(creditoNoCancelamento({ status: "entregue", taxa_paga_em: pago, taxa_valor: 40 }), 0);
  assert.equal(creditoNoCancelamento({ status: "aceito", taxa_paga_em: pago, taxa_valor: null }), 0);
});

test("validarPedido: caminho feliz e casos negativos", () => {
  const ok = validarPedido(base, "2026-10-11");
  assert.ok(ok.ok && ok.dados.cep === "38400100" && ok.dados.uf === "MG" && ok.dados.observacao === null);
  const erro = (o: Partial<typeof base>) => { const r = validarPedido({ ...base, ...o }, "2026-10-11"); return r.ok ? "" : r.erro; };
  assert.match(erro({ fotografoId: "x" }), /fotógrafo/);
  assert.match(erro({ cep: "123" }), /CEP/);
  assert.match(erro({ uf: "Minas" }), /UF/);
  assert.match(erro({ data: "2026-10-01" }), /passado/);
  assert.match(erro({ data: "2027-05-01" }), /próximos 90 dias/);
  assert.match(erro({ data: "2026-13-45" }), /data/i);
  assert.match(erro({ observacao: "x".repeat(301) }), /300/);
});

test("portfólio só https; taxa válida", () => {
  assert.equal(portfolioSeguro("https://instagram.com/foto"), "https://instagram.com/foto");
  assert.equal(portfolioSeguro("javascript:alert(1)"), null);
  assert.equal(portfolioSeguro("http://site.com"), null);
  assert.equal(taxaValida("40,50"), 40.5);
  assert.equal(taxaValida("-1"), null);
  assert.equal(taxaValida("abc"), null);
});

test("cidadeDoCep: usa ViaCEP; erro/inválido → null", async () => {
  const fake = (corpo: unknown, ok = true) => (async () => ({ ok, json: async () => corpo })) as unknown as typeof fetch;
  assert.deepEqual(await cidadeDoCep("38400100", fake({ localidade: "Uberlândia", uf: "MG" })), { cidade: "Uberlândia", uf: "MG" });
  assert.equal(await cidadeDoCep("38400100", fake({ erro: true })), null);
  assert.equal(await cidadeDoCep("38400100", fake({}, false)), null);
  assert.equal(await cidadeDoCep("abc", fake({})), null);
});
