/* E679 — PR 5: "Avalie o serviço" / "Avalie o cliente" (mockups avaliacoes-avaliar-servico-*). Roda: node --test src/lib/avaliacoes-servico.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEXTOS_SERVICO, linhaDoPedido } from "./avaliacoes-servico.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("cliente avalia o serviço: títulos do mockup", () => {
  const t = TEXTOS_SERVICO.cliente_avalia_parceiro;
  assert.equal(t.pagina, "Avalie o serviço");
  assert.equal(t.geral, "Como foi, no geral?");
  assert.equal(t.etiquetas, "Destaques do serviço");
  assert.equal(t.texto, "Conte como foi o serviço");
  assert.equal(t.recomenda, "Você contrataria de novo?");
  assert.match(t.placeholder, /o que foi feito bem/i);
});

test("parceiro avalia o cliente: aviso 'entre parceiros' e títulos do mockup", () => {
  const t = TEXTOS_SERVICO.parceiro_avalia_cliente;
  assert.equal(t.pagina, "Avalie o cliente");
  assert.equal(t.etiquetas, "Selecione tags que descrevem o cliente");
  assert.equal(t.texto, "Algum comentário sobre o atendimento?");
  assert.equal(t.avisoEntreParceiros, "Nota entre parceiros: esta avaliação aparece só para outros parceiros. Ela não fica no perfil público do cliente.");
  assert.equal(TEXTOS_SERVICO.cliente_avalia_parceiro.avisoEntreParceiros, null);
});

test("linha do pedido: 'Pedido VN-SV-… · R$ 280' (sem inventar data nem valor)", () => {
  assert.equal(linhaDoPedido({ codigo: "VN-SV-ABC12345", valor: 280 }), "Serviço concluído · Pedido VN-SV-ABC12345 · R$ 280");
  assert.equal(linhaDoPedido({ codigo: "VN-SV-ABC12345", valor: null }), "Serviço concluído · Pedido VN-SV-ABC12345");
});

test("a tela do pedido usa estrelas, os textos por par, o contador e o botão cheio, mantendo os testids dos specs", () => {
  const t = ler("app/(dashboard)/dashboard/servicos/pedidos/[id]/pedido-tela.tsx");
  assert.match(t, /TEXTOS_SERVICO\[par as keyof typeof TEXTOS_SERVICO\]/);
  for (const id of ["pedido-nota-", "pedido-criterio-", "pedido-recomendaria-sim", "pedido-recomendaria-nao", "pedido-avaliacao-texto", "pedido-avaliar", "pedido-avaliacao-contador", "pedido-avaliacao-sigilo", "pedido-avaliacao-entre-parceiros"]) assert.ok(t.includes(id), id);
  assert.match(t, /Estrela|<Star\b/);
});
