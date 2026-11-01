/*
  E402 — confirmação ao morador ao publicar e ao editar o pedido de moradia.
  Roda: node --test src/lib/pedidos/email-confirmacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { corpoConfirmacaoPedido, mudancasDoPedido, pedidoDaLinha } from "./email-confirmacao.ts";
import type { PedidoDoCartao } from "../notifications/cartoes-email.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

const PEDIDO: PedidoDoCartao = { id: "p1", cidade: "Uberlândia", uf: "MG", entrada: "2026-12-01", meses: 3, orcamento: 2500, pessoas: 2, pets: true };

test("publicado: assunto com a cidade, abertura, quantos combinam e o bloco com os dados do pedido", () => {
  const c = corpoConfirmacaoPedido("publicado", PEDIDO, { compativeis: 2 });
  assert.equal(c.subject, "Pedido de moradia publicado em Uberlândia");
  const corpo = c.body("Ana");
  assert.match(corpo, /^Olá Ana, seu pedido de moradia em Uberlândia - MG está publicado\./);
  assert.match(corpo, /2 imóveis combinam com ele agora, e os proprietários foram avisados\./);
  assert.match(corpo, /Quando um proprietário responder, você recebe aqui\./);
  assert.deepEqual(c.linhas, [
    { rotulo: "Cidade", valor: "Uberlândia - MG" },
    { rotulo: "Entrada", valor: "01/12/2026 · 3 meses" },
    { rotulo: "Orçamento", valor: "até R$ 2.500 por mês" },
    { rotulo: "Pessoas", valor: "2" },
    { rotulo: "Pets", valor: "Sim" },
  ]);
  // Sem imóvel compatível e com 1: frases certas (nada de "0 imóveis").
  assert.match(corpoConfirmacaoPedido("publicado", PEDIDO, { compativeis: 0 }).body(), /Ainda não há imóvel que combine; avisamos você quando surgir um\./);
  assert.match(corpoConfirmacaoPedido("publicado", PEDIDO, { compativeis: 1 }).body(), /1 imóvel combina com ele agora, e o proprietário foi avisado\./);
  assert.match(corpoConfirmacaoPedido("publicado", PEDIDO).body(), /^Olá, seu pedido/);
});

test("editado (R$ 2.500 → R$ 2.600): assunto de atualização, o que mudou e o valor anterior na linha", () => {
  const novo = { ...PEDIDO, orcamento: 2600 };
  assert.deepEqual(mudancasDoPedido(PEDIDO, novo), [{ rotulo: "Orçamento", de: "até R$ 2.500 por mês", para: "até R$ 2.600 por mês" }]);
  const c = corpoConfirmacaoPedido("editado", novo, { compativeis: 1, antes: PEDIDO });
  assert.equal(c.subject, "Pedido de moradia atualizado em Uberlândia");
  assert.match(c.body("Ana"), /^Olá Ana, salvamos as mudanças no seu pedido de moradia em Uberlândia - MG\. Mudou: orçamento\. 1 imóvel combina/);
  assert.deepEqual(c.linhas.find((l) => l.rotulo === "Orçamento"), { rotulo: "Orçamento", valor: "até R$ 2.600 por mês (antes: até R$ 2.500 por mês)" });
  // As linhas que não mudaram ficam como estão.
  assert.deepEqual(c.linhas.find((l) => l.rotulo === "Pessoas"), { rotulo: "Pessoas", valor: "2" });
  // Edição sem mudança nas linhas do cartão (ex.: só a apresentação): sem "Mudou:".
  assert.doesNotMatch(corpoConfirmacaoPedido("editado", PEDIDO, { antes: PEDIDO }).body(), /Mudou:/);
});

test("sem dado pessoal nem vocabulário proibido no e-mail", () => {
  const c = corpoConfirmacaoPedido("editado", { ...PEDIDO, orcamento: 2600 }, { compativeis: 3, antes: PEDIDO });
  const tudo = [c.subject, c.body("Ana"), ...c.linhas.map((l) => `${l.rotulo} ${l.valor}`)].join(" ");
  assert.doesNotMatch(tudo, /aluguel|comissão|inquilino|temporada|@|telefone/i);
});

test("pedidoDaLinha lê a linha do banco no formato do cartão", () => {
  assert.deepEqual(
    pedidoDaLinha({ id: "p1", cidade: "Uberlândia", uf: "MG", data_inicio: "2026-12-01", prazo_meses: 3, orcamento_mensal: "2500.00", qtd_ocupantes: 2, pets: true }),
    PEDIDO,
  );
});

test("servidor: publicar e editar confirmam ao morador; a edição lê a versão anterior antes do update", () => {
  const acoes = ler("src/lib/data/pedidos-actions.ts");
  const criar = acoes.slice(acoes.indexOf("export async function criarPedido"), acoes.indexOf("export async function getMeuPedido"));
  assert.match(criar, /await confirmarAoMorador\("publicado", user\.id, data\.id as string, compat\.compativeis\)/);
  const editar = acoes.slice(acoes.indexOf("export async function editarPedido"), acoes.indexOf("export async function excluirPedido"));
  assert.ok(editar.indexOf("const { data: anterior }") < editar.indexOf('.update({ ...colunasDoPedido'), "lê a versão anterior antes de gravar");
  assert.match(editar, /await confirmarAoMorador\("editado", user\.id, pedidoId, compativeis, anterior \?/);
  const conf = acoes.slice(acoes.indexOf("async function confirmarAoMorador"), acoes.indexOf("type ActionResult"));
  assert.match(conf, /event: "pedido_confirmado"/);
  assert.match(conf, /notificacaoLigada\(perfil\.notif_email/);
  assert.match(conf, /catch \{/);
  // O evento existe no catálogo, na matriz (sem push) e no cabeçalho do e-mail.
  assert.match(ler("src/lib/notifications/eventos-email.ts"), /\| "pedido_confirmado"/);
  assert.match(ler("src/config/matriz-notificacoes.ts"), /pedido_confirmado: \{ categoria: "outros", papeis: \["morador"\], canais: SEM_PUSH \}/);
  assert.match(ler("src/lib/notifications/imagens-email.ts"), /pedido_confirmado: "transacional"/);
});

test("assunto sai de assuntos.ts (fonte única) e passa nas regras dos assuntos", async () => {
  const { comMarca, problemasDoAssunto } = await import("../notifications/assuntos.ts");
  for (const acao of ["publicado", "editado"] as const) {
    for (const cidade of ["Uberlândia", "São José dos Campos", "Vila Bela da Santíssima Trindade do Norte Extra", ""]) {
      const s = corpoConfirmacaoPedido(acao, { ...PEDIDO, cidade }).subject;
      assert.deepEqual(problemasDoAssunto(comMarca(s)), [], s);
    }
  }
  assert.equal(corpoConfirmacaoPedido("publicado", { ...PEDIDO, cidade: "" }).subject, "Pedido de moradia publicado");
  assert.equal(corpoConfirmacaoPedido("editado", { ...PEDIDO, cidade: "São José dos Campos" }).subject, "Pedido de moradia atualizado em São José dos Campos");
});
