/*
  E462 — Pedido de parceiro já aceito não tinha saída: em "Orçamento aceito" o parceiro só via confirmar/propor horário,
  sem "Recusar" nem "Atualizar orçamento" (que existem no pedido recebido). Agora, no aceito e enquanto não há pagamento
  registrado, o parceiro tem as duas saídas, com o mesmo padrão do pedido recebido:
   - Atualizar orçamento → volta a "Orçamento enviado" (orcado); o cliente decide de novo. Os valores congelados no
     aceite (taxa, parte do parceiro) saem, porque o banco exige taxa + parceiro = valor combinado.
   - Recusar o pedido → "recusado", com o mesmo aviso e o link "Pedir a outro parceiro".
  Roda: node --test src/lib/parceiros/e462-aceito-saidas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRANSICOES, podeFazer, saidaDoAceitoLiberada, proximoPasso } from "./pedido.ts";

const actions = readFileSync(new URL("./pedido-actions.ts", import.meta.url), "utf8");
const tela = readFileSync(new URL("../../app/(dashboard)/dashboard/servicos/pedidos/[id]/pedido-tela.tsx", import.meta.url), "utf8");
const trecho = (src: string, de: string, ate: string) => src.slice(src.indexOf(de), src.indexOf(ate, src.indexOf(de)));

test("transições: o parceiro atualiza (→ orcado) ou recusa (→ recusado) a partir do aceito; só o parceiro", () => {
  assert.deepEqual([...TRANSICOES.orcar.de], ["solicitado", "orcado", "aceito"]);
  assert.equal(TRANSICOES.orcar.para, "orcado");
  assert.deepEqual([...TRANSICOES.recusar_pedido.de], ["solicitado", "orcado", "aceito"]);
  assert.equal(TRANSICOES.recusar_pedido.para, "recusado");
  assert.ok(podeFazer("recusar_pedido", "aceito", "parceiro"));
  assert.equal(podeFazer("recusar_pedido", "aceito", "cliente"), false);
  for (const s of ["agendado", "em_execucao", "entregue", "concluido"]) {
    assert.equal(podeFazer("orcar", s, "parceiro"), false, s);
    assert.equal(podeFazer("recusar_pedido", s, "parceiro"), false, s);
  }
});

test("saidaDoAceitoLiberada: no aceito só sem pagamento registrado; recebido/orçado sempre", () => {
  assert.equal(saidaDoAceitoLiberada("aceito", "indisponivel"), true);
  assert.equal(saidaDoAceitoLiberada("aceito", "simulado"), false);
  assert.equal(saidaDoAceitoLiberada("aceito", "pago"), false);
  assert.equal(saidaDoAceitoLiberada("solicitado", "indisponivel"), true);
  assert.equal(saidaDoAceitoLiberada("orcado", "indisponivel"), true);
});

test("servidor: enviarOrcamento e recusarPedido barram o aceito com pagamento e o reorçamento limpa os valores congelados", () => {
  const orcar = trecho(actions, "export async function enviarOrcamento", "\n}\n");
  assert.match(orcar, /saidaDoAceitoLiberada\(p\.status, p\.pagamento_status\)/);
  assert.match(orcar, /taxa_percent: null, valor_taxa: null, valor_parceiro: null/);
  const recusar = trecho(actions, "export async function recusarPedido", "\n}\n");
  assert.match(recusar, /saidaDoAceitoLiberada\(p\.status, p\.pagamento_status\)/);
});

test("tela: o bloco do parceiro aparece também no aceito (sem pagamento), com 'Atualizar orçamento' e 'Recusar o pedido'", () => {
  const acoes = trecho(tela, "function Acoes(", "function ProporHorario(");
  assert.match(acoes, /parceiro && \["solicitado", "orcado", "aceito"\]\.includes\(d\.status\) && saidaDoAceitoLiberada\(d\.status, d\.pagamentoStatus\)/);
  assert.match(acoes, /d\.status === "solicitado" \? "Enviar orçamento" : "Atualizar orçamento"/);
  assert.match(acoes, /testid="pedido-recusar"/);
  assert.match(acoes, /AVISO_ATUALIZAR_ACEITO/);
});

test("próximo passo do parceiro no aceito cita as saídas", () => {
  assert.match(proximoPasso("aceito", "parceiro") ?? "", /Confirme um dos horários/);
  assert.match(proximoPasso("aceito", "parceiro") ?? "", /atualize o orçamento ou recuse/);
});
