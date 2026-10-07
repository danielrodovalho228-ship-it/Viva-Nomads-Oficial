/*
  Chat da Central sem falsas aprovações e sem jogar no Daniel o que não é dele.
  Roda: node --test src/lib/agentes/aprovacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { DECISOES_DO_CEO, esperaDanielIndevida, NOTA_CEO, pedeAprovacao, REGRA_CEO, RESPOSTA_APROVACAO, systemChat, systemReuniao, type Agente } from "./central.ts";
import { systemGerente } from "./gerente.ts";
import { responderChat, type Deps } from "./motor.ts";

test("aprovação no chat: 'ok', 'tudo aprovado', 'pode aplicar a 0087' são aprovação; perguntas e pedidos não", () => {
  for (const t of ["ok", "Ok\nTudo aprovado", "OK, aplicar a 0083", "aprovado", "Sim", "pode aplicar", "autorizo o merge", "de acordo", "okk"]) assert.ok(pedeAprovacao(t), t);
  for (const t of ["ok, e os chamados?", "alguma pendência?", "como estamos", "corrija o sitemap", "Aplica a 0083 e corrige o bug do sitemap", "Ok, me explica melhor o que falta na fila do Otávio antes de amanhã cedo", "sim ou não: a 0083 já foi aplicada?"]) assert.ok(!pedeAprovacao(t), t);
});

test("rede de segurança: 'aguardando aprovação do Daniel' só é aceito para assunto do CEO", () => {
  assert.ok(esperaDanielIndevida("O ajuste do texto da home está aguardando aprovação do Daniel."));
  assert.ok(esperaDanielIndevida("Item #30: depende do Daniel."));
  assert.ok(!esperaDanielIndevida("A migração 0087 está aguardando sua aprovação."));
  assert.ok(!esperaDanielIndevida("O PR #305 aguarda o seu ok para mesclar."));
  assert.ok(!esperaDanielIndevida("O contrato com a seguradora depende do Daniel."));
  assert.ok(!esperaDanielIndevida("Tudo certo por aqui."));
});

test("todos os prompts levam a regra do CEO (chat, reunião e Moacir)", () => {
  const a: Agente = { slug: "otavio", nome: "Otávio", cargo: "Supervisor", esquadrao: "comando", rotina_texto: null, trigger_id: null, status: "ativo", briefing: "B.", ordem: 1 };
  for (const s of [systemChat(a, [], []), systemReuniao([{ agente: a, rondas: [] }]), systemGerente({ briefing: "G.", agora: new Date(), contexto: "C." })]) {
    assert.ok(s.includes(REGRA_CEO));
    assert.ok(s.includes(DECISOES_DO_CEO));
    assert.ok(s.includes("nunca \"aguardando aprovação do Daniel\""));
  }
  assert.match(systemGerente({ briefing: "G.", agora: new Date(), contexto: "C." }), /no máximo 3 itens/);
});

function fake(resposta = "Tudo certo.") {
  const gravadas: { papel: string; texto: string }[] = [];
  let chamouModelo = 0;
  const d: Deps = {
    adminId: async () => "admin-1",
    perguntasHoje: async () => 0,
    agentes: async () => [{ slug: "otavio", nome: "Otávio", cargo: "S", esquadrao: "comando", rotina_texto: null, trigger_id: "t", status: "ativo", briefing: "B.", ordem: 1 }],
    rondas: async () => [],
    ordensAbertas: async () => [],
    historico: async () => [],
    retrato: async () => null,
    gravar: async (l) => void gravadas.push(...l),
    modelo: async () => (chamouModelo++, resposta),
  };
  return { d, gravadas, chamou: () => chamouModelo };
}

test("'ok' no chat: resposta fixa, nada aprovado, modelo nem é chamado", async () => {
  const f = fake();
  const r = await responderChat(f.d, { slug: "otavio", texto: "Ok\nTudo aprovado" });
  assert.equal(r.status, 200);
  assert.equal(r.body.resposta, RESPOSTA_APROVACAO);
  assert.equal(r.body.aprovacao, false);
  assert.equal(f.chamou(), 0);
  assert.deepEqual(f.gravadas.map((g) => g.papel), ["daniel", "agente"]);
  assert.match(RESPOSTA_APROVACAO, /só vale pelo Claude Code .* ou rodando o SQL no SQL Editor/);
});

test("resposta do modelo que espera o Daniel à toa ganha a correção", async () => {
  const f = fake("O ajuste do rodapé está aguardando aprovação do Daniel.");
  const r = await responderChat(f.d, { slug: "otavio", texto: "e o rodapé?" });
  assert.ok(String(r.body.resposta).endsWith(NOTA_CEO));
  const ok = fake("A 0087 está aguardando sua aprovação da migração.");
  assert.ok(!String((await responderChat(ok.d, { slug: "otavio", texto: "e a 0087?" })).body.resposta).includes(NOTA_CEO));
});
