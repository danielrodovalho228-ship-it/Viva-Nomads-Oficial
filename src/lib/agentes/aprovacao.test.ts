/*
  Chat da Central sem falsas aprovações e sem jogar no Daniel o que não é dele.
  Roda: node --test src/lib/agentes/aprovacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { DECISOES_DO_CEO, esperaDanielIndevida, NOTA_CEO, pedeAprovacao, REGRA_CEO, RESPOSTA_APROVACAO, systemChat, systemReuniao, type Agente } from "./central.ts";
import { respostaAprovacaoNoChat, rotuloMescla, type CartaoAprovacao } from "./aprovacoes.ts";
import { systemGerente } from "./gerente.ts";
import { responderChat, type Deps } from "./motor.ts";

test("aprovação no chat: só com verbo explícito E cartão pendente; 'sim', 'ok', 'peça', 'traga agora' respondem à oferta", () => {
  for (const t of ["aprovo o #366", "Ok\nTudo aprovado", "autorizo o merge", "pode aplicar", "pode mesclar o PR"]) assert.ok(pedeAprovacao(t, 1), t);
  // Sem cartão pendente nada é aprovação, nem com o verbo.
  for (const t of ["aprovo o #366", "Tudo aprovado", "pode aplicar"]) assert.ok(!pedeAprovacao(t, 0), t);
  // Regressão do print de 10/10: estas NÃO são aprovação nem com cartão pendente.
  for (const t of ["Sim peça", "Okay resolva tudo Moacir obrigado", "Traga agora", "sim", "ok", "pode", "faça", "de acordo", "okk"]) assert.ok(!pedeAprovacao(t, 2), t);
  for (const t of ["ok, e os chamados?", "alguma pendência?", "como estamos", "corrija o sitemap", "sim ou não: a 0083 já foi aplicada?"]) assert.ok(!pedeAprovacao(t, 1), t);
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
  assert.match(RESPOSTA_APROVACAO, /não aprovo por texto/);
  assert.doesNotMatch(RESPOSTA_APROVACAO, /SQL Editor/);
});

const cartao = (referencia: string): CartaoAprovacao => ({ id: referencia, tipo: "merge_pr", referencia, resumo: "r", risco: "medio", expiraEm: "2026-10-13T00:00:00Z" });

test("'aprovo' com 1 cartão pendente: pergunta 'Aprovar o PR?' e manda para o botão; nada é aprovado por texto", async () => {
  const f = fake();
  f.d.aprovacoesPendentes = async () => [cartao("PR #341")];
  const r = await responderChat(f.d, { slug: "otavio", texto: "aprovo o PR #341" });
  assert.match(String(r.body.resposta), /^Aprovar PR #341\? Toque em Aprovar no cartão e depois em Confirmar/);
  assert.equal(r.body.aprovacao, false);
  assert.equal(f.chamou(), 0);
});

test("'ok' com vários, nenhum ou falha ao ler os pedidos: nunca aprova", () => {
  assert.match(respostaAprovacaoNoChat([cartao("PR #1"), cartao("PR #2")]), /Há 2 pedidos.*Escolha o cartão/);
  assert.match(respostaAprovacaoNoChat([]), /Não há pedido esperando/);
  assert.match(respostaAprovacaoNoChat(null), /não aprovo por texto/);
  for (const t of [respostaAprovacaoNoChat([cartao("PR #1")]), respostaAprovacaoNoChat([]), respostaAprovacaoNoChat(null)]) assert.doesNotMatch(t, /aprovado\b|registrei/i);
});

test("leitura dos pedidos que falha não derruba o chat", async () => {
  const f = fake();
  f.d.aprovacoesPendentes = async () => {
    throw new Error("banco fora");
  };
  const r = await responderChat(f.d, { slug: "otavio", texto: "aprovo" });
  assert.equal(r.status, 200);
  assert.match(String(r.body.resposta), /não aprovo por texto/);
});

test("rótulos da mescla cobrem todos os resultados", () => {
  assert.equal(rotuloMescla("mesclado"), "Aprovado e mesclado.");
  for (const m of ["aguardando_token", "pr_mudou", "pr_nao_pronto", "sem_revisao_moacir", "falhou"]) assert.match(rotuloMescla(m), /^Aprovado/);
  assert.equal(rotuloMescla(undefined), "Registrado.");
});

test("resposta do modelo que espera o Daniel à toa ganha a correção", async () => {
  const f = fake("O ajuste do rodapé está aguardando aprovação do Daniel.");
  const r = await responderChat(f.d, { slug: "otavio", texto: "e o rodapé?" });
  assert.ok(String(r.body.resposta).endsWith(NOTA_CEO));
  const ok = fake("A 0087 está aguardando sua aprovação da migração.");
  assert.ok(!String((await responderChat(ok.d, { slug: "otavio", texto: "e a 0087?" })).body.resposta).includes(NOTA_CEO));
});

test("'Sim peça' / 'Okay resolva tudo' / 'Traga agora' vão ao modelo (resposta à oferta), não à recusa fixa", async () => {
  for (const texto of ["Sim peça", "Okay resolva tudo Moacir obrigado", "Traga agora"]) {
    const f = fake("Peço agora ao Renato.");
    f.d.aprovacoesPendentes = async () => [cartao("PR #341")];
    const r = await responderChat(f.d, { slug: "otavio", texto });
    assert.notEqual(r.body.resposta, RESPOSTA_APROVACAO, texto);
    assert.doesNotMatch(String(r.body.resposta), /não aprovo por texto/, texto);
    assert.equal(f.chamou(), 1, texto);
  }
});

test("'aprovo' sem nenhum cartão pendente não é aprovação: o modelo responde (e a regra do CEO segue no prompt)", async () => {
  const f = fake("Não há nada pendente.");
  f.d.aprovacoesPendentes = async () => [];
  const r = await responderChat(f.d, { slug: "otavio", texto: "aprovo o #366" });
  assert.equal(r.body.aprovacao, undefined);
  assert.equal(f.chamou(), 1);
});
