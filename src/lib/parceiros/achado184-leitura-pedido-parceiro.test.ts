import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Achado 184 (varredura "leitura que falha não vira outra resposta"): nos pedidos a parceiros, a leitura do pedido
 * (carregar) e do parceiro/serviço (solicitarOrcamento) sem olhar o erro virava "Pedido não encontrado." / "Este parceiro
 * não está recebendo pedidos agora." / "Escolha um serviço da lista do parceiro.".
 */
const fonte = readFileSync(new URL("./pedido-actions.ts", import.meta.url), "utf8");
const carregar = fonte.slice(fonte.indexOf("async function carregar("), fonte.indexOf("\n}\n", fonte.indexOf("async function carregar(")) + 2);
const solicitar = fonte.slice(fonte.indexOf("export async function solicitarOrcamento("));

test("carregar: leitura do pedido com erro não vira 'Pedido não encontrado'", () => {
  assert.match(carregar, /const \{ data, error: erroPedido \} = await s\.admin\.from\("parceiro_pedidos"\)/);
  const g = carregar.indexOf("if (erroPedido)");
  assert.ok(g >= 0);
  assert.match(carregar.slice(g, g + 140), /Não foi possível ler o pedido agora/);
  assert.ok(g < carregar.indexOf("if (!p || !p.parceiros)"));
});

test("solicitarOrcamento: leitura do parceiro com erro não vira 'não está recebendo pedidos'", () => {
  assert.match(solicitar, /const \{ data: parc, error: erroParceiro \} = await admin\.from\("parceiros"\)/);
  const g = solicitar.indexOf("if (erroParceiro)");
  assert.ok(g >= 0);
  assert.match(solicitar.slice(g, g + 150), /Não foi possível ler o parceiro agora/);
  assert.ok(g < solicitar.indexOf("Este parceiro não está recebendo pedidos agora."));
});

test("solicitarOrcamento: leitura do serviço com erro não vira 'Escolha um serviço da lista'", () => {
  assert.match(solicitar, /const \{ data: sv, error: erroServico \} = await admin\.from\("parceiro_servicos"\)/);
  const g = solicitar.indexOf("if (erroServico)");
  assert.ok(g >= 0);
  assert.ok(g < solicitar.indexOf("Escolha um serviço da lista do parceiro."));
});
