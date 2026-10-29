/*
  E213-B — limpeza D-5 × renovação dentro da janela (regras puras + guardas do servidor).
  Roda: node --test src/lib/automacao/remarcacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  chaveAntiga,
  chaveRemarcada,
  chaveSaidaSemParceiro,
  chaveSugestaoMorador,
  decidirRecusaDaNovaData,
  decidirRemarcacao,
  diasAte,
  MSG_SAIDA_MUDOU,
  reagendamentoPendente,
  saidaPerto,
  textoReagendamento,
} from "./remarcacao.ts";
import { chaveAutomacao } from "./pedidos-do-evento.ts";

const HOJE = "2026-11-10";

test("distância da nova saída: até 5 dias é perto (a mesma régua do cron D-5)", () => {
  assert.equal(diasAte(HOJE, "2026-11-15"), 5);
  assert.equal(saidaPerto("2026-11-15", HOJE), true);
  assert.equal(saidaPerto("2026-11-16", HOJE), false);
  assert.equal(saidaPerto("2026-11-10", HOJE), true, "saída hoje: perto");
  assert.equal(diasAte("2026-12-30", "2027-01-02"), 3, "virada de ano");
});

test("1. sem aceite e a nova saída a até 5 dias → atualiza a janela (mesma chave)", () => {
  for (const s of ["solicitado", "orcado"]) assert.equal(decidirRemarcacao(s, "2026-11-13", HOJE), "atualizar_janela", s);
  assert.equal(decidirRemarcacao("solicitado", "2026-11-15", HOJE), "atualizar_janela", "D-5 exato");
});

test("2. sem aceite e a nova saída a mais de 5 dias → cancela com o sufixo; a chave original fica livre", () => {
  for (const s of ["solicitado", "orcado"]) assert.equal(decidirRemarcacao(s, "2026-12-10", HOJE), "cancelar_remarcado", s);
  assert.equal(decidirRemarcacao("solicitado", "2026-11-16", HOJE), "cancelar_remarcado", "D-6");
  const base = chaveAutomacao("im1", "limpeza", "ct1", "saida");
  const velha = chaveRemarcada(base, 1_790_000_000_000);
  assert.equal(velha, "im1:limpeza:ct1:saida:remarcado:1790000000000");
  assert.ok(velha.startsWith(base) && velha !== base, "o cron recria com a chave original, sem bater no índice único");
  assert.equal(MSG_SAIDA_MUDOU, "A saída mudou; o pedido volta a ser feito perto da nova data.");
});

test("3. já aceito (aceito/agendado) → reagendamento, perto ou longe; o resto não mexe", () => {
  for (const s of ["aceito", "agendado"]) {
    assert.equal(decidirRemarcacao(s, "2026-11-12", HOJE), "reagendar", `${s} perto`);
    assert.equal(decidirRemarcacao(s, "2027-01-10", HOJE), "reagendar", `${s} longe`);
  }
  for (const s of ["em_execucao", "entregue", "concluido", "recusado", "cancelado"]) assert.equal(decidirRemarcacao(s, "2026-12-10", HOJE), "nada", s);
  const t = textoReagendamento({ inicio: "10/12 às 13:00", fim: "12/12 às 11:00" });
  assert.match(t, /Nova janela: entre 10\/12 às 13:00 e 12\/12 às 11:00\./);
  assert.match(t, /O valor combinado continua o mesmo\./);
  assert.doesNotMatch(t, /R\$|orçamento novo/, "sem orçamento novo; o valor não aparece nem muda");
});

test("3 (recusa). o parceiro recusa a nova data → caminho sem aceite: perto volta a esperar; longe cancela com sufixo", () => {
  assert.equal(decidirRecusaDaNovaData("2026-11-14", HOJE), "voltar_sem_aceite");
  assert.equal(decidirRecusaDaNovaData("2026-12-14", HOJE), "cancelar_remarcado");
});

test("reagendamento pendente: só 'aceito' e o último evento de horário é o reagendamento", () => {
  assert.equal(reagendamentoPendente("aceito", ["reagendamento"]), true);
  assert.equal(reagendamentoPendente("aceito", ["propor_horario", "reagendamento", "confirmar_horario"]), true, "eventos de fora são ignorados");
  assert.equal(reagendamentoPendente("aceito", ["confirmar_horario", "reagendamento"]), false, "o parceiro já confirmou o horário novo");
  assert.equal(reagendamentoPendente("aceito", ["recusar_nova_data", "reagendamento"]), false);
  assert.equal(reagendamentoPendente("agendado", ["reagendamento"]), false);
  assert.equal(reagendamentoPendente("aceito", []), false, "aceite comum, sem renovação");
});

test("pedido que saiu da frente: troca de parceiro e remarcação", () => {
  assert.equal(chaveAntiga("im1:limpeza:ct1:saida"), false);
  assert.equal(chaveAntiga("im1:limpeza:ct1:saida:troca:123"), true);
  assert.equal(chaveAntiga("im1:limpeza:ct1:saida:remarcado:123"), true);
});

test("4. as chaves de 'uma vez' dos avisos da saída levam a data: depois de renovar, o aviso sai de novo", () => {
  const antes = chaveSugestaoMorador("ct1", "m1", "saida", "2026-11-14");
  const depois = chaveSugestaoMorador("ct1", "m1", "saida", "2026-12-14");
  assert.equal(antes, "sugestao_parceiros_morador:ct1:m1:saida:2026-11-14");
  assert.notEqual(antes, depois);
  assert.equal(chaveSugestaoMorador("ct1", "m1", "saida", "2026-11-14"), antes, "mesma saída: uma vez só");
  assert.equal(chaveSugestaoMorador("ct1", "m1", "entrada", null), "sugestao_parceiros_morador:ct1:m1:entrada");
  assert.notEqual(chaveSaidaSemParceiro("ct1", "d1", "2026-11-14"), chaveSaidaSemParceiro("ct1", "d1", "2026-12-14"));
});

test("GUARDAS: o servidor usa a regra pura, o sufixo e a data nas chaves; o reagendamento não mexe em valores", () => {
  const srv = readFileSync(new URL("./servidor.ts", import.meta.url), "utf8");
  assert.match(srv, /decidirRemarcacao\(p\.status, saida, hojeEmBrasilia\(agora\)\)/);
  assert.match(srv, /chave_automacao: chaveRemarcada\(p\.chave_automacao, agora\.getTime\(\)\)/);
  assert.match(srv, /status: "aceito", horario_confirmado: null/);
  assert.match(srv, /chaveSugestaoMorador\(ctx\.id, ctx\.tenantId, a\.momento, a\.momento === "saida" \? ctx\.saida : ctx\.inicio\)/);
  assert.match(srv, /chaveSaidaSemParceiro\(ctx\.id, ctx\.ownerId, ctx\.saida\)/);
  assert.doesNotMatch(srv, /valor_combinado/, "reagendar não muda o valor combinado");
  // A chave do pedido nunca vira (contrato, saída): continua um pedido por saída.
  assert.match(readFileSync(new URL("./pedidos-do-evento.ts", import.meta.url), "utf8"), /return `\$\{propertyId\}:\$\{categoria\}:\$\{contratoId\}:\$\{evento\}`;/);
  const cron = readFileSync(new URL("../../app/api/cron/automacoes/route.ts", import.meta.url), "utf8");
  assert.match(cron, /tipo: "saida_lembrete", usuarioId: u, refId: c\.id as string, variante: fimFinal/);
  assert.match(readFileSync(new URL("./estadia.ts", import.meta.url), "utf8"), /!chaveAntiga\(p\.chave_automacao\)/);
  const rotaPedido = readFileSync(new URL("../../app/api/parceiros/pedidos/[id]/route.ts", import.meta.url), "utf8");
  assert.match(rotaPedido, /"recusar-nova-data": \(id\) => recusarNovaData\(id\)/);
  const recusa = readFileSync(new URL("./reagendamento-servidor.ts", import.meta.url), "utf8");
  assert.match(recusa, /p\.parceiros\?\.user_id !== user\.id/, "só o parceiro do pedido recusa");
  assert.match(recusa, /reagendamentoPendente\(p\.status, tipos\)/);
  assert.match(recusa, /decidirRecusaDaNovaData\(ctx\.saida/);
});
