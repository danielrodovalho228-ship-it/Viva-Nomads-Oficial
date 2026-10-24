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
  STATUS_PEDIDO,
  TEXTO_CONTATO_ANTES_DO_ACEITE,
  contatoNoPedido,
  linkOutroParceiro,
  telefoneNaTela,
  textoRecusaAoCliente,
  validarMotivoRecusa,
} from "./pedido.ts";
import { MATRIZ_NOTIFICACOES } from "../../config/matriz-notificacoes.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const CONTATO = { telefone: "34999998888", email: "parceiro@exemplo.com" };

test("item 16: contato só depois do aceite; antes, a conversa segue pela plataforma", () => {
  const depois = ["aceito", "agendado", "em_execucao", "entregue", "concluido"];
  for (const s of STATUS_PEDIDO) {
    const c = contatoNoPedido(s, CONTATO);
    if (depois.includes(s)) assert.deepEqual(c, CONTATO, s);
    else assert.equal(c, null, `${s}: sem contato`);
  }
  assert.equal(contatoNoPedido("aceito", { telefone: null, email: " " }), null, "sem dado nenhum: nada a mostrar");
  assert.deepEqual(contatoNoPedido("aceito", { telefone: "(34) 99999-8888", email: null }), { telefone: "34999998888", email: null });
  assert.equal(telefoneNaTela("34999998888"), "(34) 99999-8888");
  assert.equal(telefoneNaTela("553432101234"), "(34) 3210-1234");
  assert.equal(TEXTO_CONTATO_ANTES_DO_ACEITE, "Antes do aceite do orçamento, a conversa segue pela plataforma.");
});

test("item 16: o servidor só LÊ o contato depois do aceite, das duas partes, e a tela mostra", () => {
  const acoes = ler("src/lib/parceiros/pedido-actions.ts");
  // A leitura sai de contatoDaOutraParte, que para antes de tocar o banco quando o status não libera.
  assert.match(acoes, /async function contatoDaOutraParte[\s\S]{0,200}if \(!contatoNoPedido\(p\.status, \{ telefone: "x", email: null \}\)\) return null;/);
  assert.match(acoes, /const outro = papel === "cliente" \? p\.parceiros!\.user_id : p\.cliente_id;/);
  assert.match(acoes, /from\("parceiros"\)\.select\("telefone"\)/);
  assert.match(acoes, /contato,\n\s+linkOutroParceiro: linkOutroParceiro\(p\.categoria\),/);
  const tela = ler("src/app/(dashboard)/dashboard/servicos/pedidos/[id]/pedido-tela.tsx");
  assert.match(tela, /data-testid="pedido-contato-telefone"/);
  assert.match(tela, /data-testid="pedido-contato-email"/);
  assert.match(tela, /data-testid="pedido-contato-antes"[\s\S]{0,80}TEXTO_CONTATO_ANTES_DO_ACEITE/);
  // A Viva não intermedeia o pagamento: o texto do pagamento inativo acompanha o contato.
  assert.match(tela, /<li className="mt-1 text-muted">\{TEXTO_PAGAMENTO_INATIVO\}<\/li>/);
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
