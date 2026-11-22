/*
  L2-B item 16 (contato do parceiro depois do aceite) e item 17 (recusa: aviso ao cliente, confirmação, motivo
  opcional, ação idempotente). Roda: node --test src/lib/parceiros/contato-recusa.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AVISO_RECUSAR_ORCAMENTO,
  AVISO_RECUSAR_PEDIDO,
  MOTIVO_RECUSA_MAX,
  TEXTO_CONTATO_PEDIDO,
  linkOutroParceiro,
  telefoneNaTela,
  textoRecusaAoCliente,
  validarMotivoRecusa,
} from "./pedido.ts";
import { MATRIZ_NOTIFICACOES } from "../../config/matriz-notificacoes.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("E790 (regra E445): o pedido nunca entrega o contato da outra parte, em nenhum status", () => {
  assert.equal(TEXTO_CONTATO_PEDIDO, "O contato não é trocado: a conversa segue pelas mensagens da Viva, antes e depois do aceite.");
  assert.equal(telefoneNaTela("34999998888"), "(34) 99999-8888");
  const acoes = ler("src/lib/parceiros/pedido-actions.ts");
  assert.doesNotMatch(acoes, /contatoDaOutraParte|contatoNoPedido|ContatoDoPedido/);
  assert.doesNotMatch(acoes, /from\("profiles"\)\.select\("email, phone"\)/);
  assert.doesNotMatch(acoes, /from\("parceiros"\)\.select\("telefone"\)/);
  assert.doesNotMatch(acoes, /^\s+contato,$/m);
  const tela = ler("src/app/(dashboard)/dashboard/servicos/pedidos/[id]/pedido-tela.tsx");
  assert.doesNotMatch(tela, /pedido-contato-telefone|pedido-contato-email|d\.contato/);
  assert.match(tela, /data-testid="pedido-contato-nunca"[\s\S]{0,40}TEXTO_CONTATO_PEDIDO/);
});

test("item 17 (i): recusa avisa o cliente com o motivo e o link 'Pedir a outro parceiro'", () => {
  assert.equal(textoRecusaAoCliente("Foto Lab", "agenda cheia"), "Foto Lab recusou o seu pedido. Motivo: agenda cheia. Você pode pedir a outro parceiro.");
  assert.equal(textoRecusaAoCliente("Foto Lab", null), "Foto Lab recusou o seu pedido. Você pode pedir a outro parceiro.");
  assert.equal(linkOutroParceiro("limpeza"), "/parceiros/buscar?categoria=limpeza");
  const m = (MATRIZ_NOTIFICACOES as Record<string, { categoria: string; papeis: string[]; canais: string[] }>).parceiro_pedido_recusado;
  assert.ok(m, "evento na matriz");
  assert.ok(m.canais.includes("central") && m.canais.includes("email"), "no app (central) e por e-mail");
  assert.match(ler("src/lib/notifications/eventos-email.ts"), /parceiro_pedido_recusado: \{ subject: "O parceiro recusou o seu pedido"/);
  const acoes = ler("src/lib/parceiros/pedido-actions.ts");
  assert.match(acoes, /avisar\(admin, p\.cliente_id, "parceiro_pedido_recusado", p\.id, \{\s*texto: textoRecusaAoCliente\(p\.parceiros!\.nome_publico, m\),\s*url: linkOutroParceiro\(p\.categoria\),/);
  assert.match(ler("src/app/(dashboard)/dashboard/servicos/pedidos/[id]/pedido-tela.tsx"), /data-testid="pedido-outro-parceiro"/);
});

test("item 17 (ii): todo 'Recusar' confirma, motivo opcional, ação idempotente", () => {
  assert.equal(AVISO_RECUSAR_PEDIDO, "Recusar este pedido? O cliente será avisado.");
  assert.ok(AVISO_RECUSAR_ORCAMENTO.startsWith("Recusar este orçamento?"));
  assert.deepEqual(validarMotivoRecusa(""), { ok: true, motivo: null });
  assert.deepEqual(validarMotivoRecusa(undefined), { ok: true, motivo: null });
  assert.deepEqual(validarMotivoRecusa("  agenda   cheia "), { ok: true, motivo: "agenda cheia" });
  assert.equal(validarMotivoRecusa("x".repeat(MOTIVO_RECUSA_MAX + 1)).ok, false);
  const tela = ler("src/app/(dashboard)/dashboard/servicos/pedidos/[id]/pedido-tela.tsx");
  assert.match(tela, /<ConfirmarNaPagina aviso=\{AVISO_RECUSAR_PEDIDO\} confirmar="Recusar o pedido" disabled=\{pendente\}/, "sem motivo obrigatório");
  assert.match(tela, /<ConfirmarNaPagina aviso=\{AVISO_RECUSAR_ORCAMENTO\} confirmar="Recusar o orçamento"/);
  assert.doesNotMatch(tela, /motivo\.trim\(\)\.length < 3/);
  const acoes = ler("src/lib/parceiros/pedido-actions.ts");
  assert.match(acoes, /if \(!r\.ok && \(await jaFeito\(pedidoId, "parceiro", "recusado"\)\)\) return \{ ok: true, valor: null \};/);
  assert.match(acoes, /if \(!r\.ok && \(await jaFeito\(pedidoId, "cliente", "cancelado"\)\)\) return \{ ok: true, valor: null \};/);
});
