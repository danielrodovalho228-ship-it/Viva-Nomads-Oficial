import { test } from "node:test";
import assert from "node:assert/strict";
import {
  avisoOrdem,
  contarP1,
  inicioDoDiaBrasilia,
  iniciais,
  lerReuniao,
  modeloAgentes,
  proximaRonda,
  statusDoAgente,
  systemChat,
  type Agente,
  type Conversa,
} from "./central.ts";
import { montarMensagens, responderChat, responderReuniao, type Deps } from "./motor.ts";
import { retratoEmTexto, type Retrato } from "./retrato.ts";

const RETRATO: Retrato = {
  em: "2026-10-07T11:15:00Z",
  cadastros: { proprietarios: 5, inquilinos: 3, admins: 1, total: 9, pareceTeste: 9 },
  imoveis: { total: 3, publicados: 2 },
  pedidos: { total: 0, ultimas24h: 0 },
  leads: { total: 0, ultimas24h: 0 },
  contratosPorStatus: {},
  chamadosAbertosPorPrioridade: { p2: 1 },
  rondas: [],
  ordensPendentes: [],
  agentes: [{ nome: "Bruno", status: "ativo", rotina_texto: "Todo dia 02:52 Brasília" }],
};

const ag = (slug: string, nome: string, extra: Partial<Agente> = {}): Agente => ({
  slug,
  nome,
  cargo: "Cargo",
  esquadrao: "tecnologia",
  rotina_texto: "Todo dia 02:52 Brasília",
  trigger_id: null,
  status: "ativo",
  briefing: "Briefing.",
  ordem: 1,
  ...extra,
});
const AGENTES = [ag("moacir", "Moacir", { esquadrao: "comando", rotina_texto: "Sempre ativo no Cowork" }), ag("bruno", "Bruno"), ag("carla", "Carla"), ag("viva", "Viva", { status: "planejado", rotina_texto: null })];

function fake(over: Partial<Deps> = {}) {
  const gravadas: { papel: string; texto: string; agente_slug: string | null }[] = [];
  const chamadas: { maxTokens: number; json: boolean; system: string }[] = [];
  const d: Deps = {
    adminId: async () => "admin-1",
    perguntasHoje: async () => 0,
    agentes: async () => AGENTES,
    rondas: async () => [],
    ordensAbertas: async () => [],
    historico: async () => [],
    retrato: async () => RETRATO,
    gravar: async (l) => void gravadas.push(...l),
    modelo: async (p) => {
      chamadas.push(p);
      return p.json
        ? JSON.stringify({ falas: [{ slug: "moacir", texto: "Fecho assim." }, { slug: "bruno", texto: "Build ok." }], consolidado: { texto: "Seguir.", passos: [{ dono: "bruno", acao: "Rodar QA" }] } })
        : "Tudo certo por aqui.";
    },
    ...over,
  };
  return { d, gravadas, chamadas };
}

test("modelo: AGENTES_MODELO vale; inválido ou vazio cai no da Viva", () => {
  assert.equal(modeloAgentes("claude-sonnet-5-5", "claude-opus-5-5"), "claude-sonnet-5-5");
  assert.equal(modeloAgentes(undefined, "claude-opus-5-5"), "claude-opus-5-5");
  assert.equal(modeloAgentes("gpt-4", "claude-haiku-4-5"), "claude-haiku-4-5");
});

test("iniciais e status do agente", () => {
  assert.equal(iniciais("Otávio"), "OT");
  assert.equal(iniciais("Ana Lima"), "AL");
  assert.equal(statusDoAgente({ status: "planejado" }, undefined), "planejado");
  assert.equal(statusDoAgente({ status: "ativo" }, undefined), "sem_ronda");
  assert.equal(statusDoAgente({ status: "ativo" }, { status: "ok" }), "espera");
  assert.equal(statusDoAgente({ status: "ativo" }, { status: "falhou" }), "falhou");
});

test("próxima ronda a partir da rotina (fusos de Brasília e Texas)", () => {
  // 2026-10-07 é quarta; 12:00 UTC = 09:00 em Brasília = 07:00 no Texas (CDT).
  const agora = new Date("2026-10-07T12:00:00Z");
  assert.equal(proximaRonda("Todo dia 06:13 Brasília", agora), "amanhã 06:13 Brasília");
  assert.equal(proximaRonda("Todo dia 07:22 Texas", agora), "hoje 07:22 Texas");
  assert.equal(proximaRonda("Quintas 07:39 Brasília", agora), "amanhã 07:39 Brasília");
  assert.equal(proximaRonda("Segundas 07:47 Brasília", agora), "segunda 07:47 Brasília");
  assert.equal(proximaRonda("Quartas 03:37 Brasília", agora), "quarta 03:37 Brasília");
  assert.equal(proximaRonda("Sempre ativo no Cowork · relatório 9h Texas", agora), null);
  assert.equal(avisoOrdem({ nome: "Bruno", rotina_texto: "Todo dia 02:52 Brasília" }, agora), "O Bruno lê na próxima ronda (amanhã 02:52 Brasília).");
});

test("P1 das últimas 24h e início do dia em Brasília", () => {
  const agora = new Date("2026-10-07T12:00:00Z");
  const r = [
    { iniciada_em: "2026-10-07T05:00:00Z", achados: [{ prioridade: "P1" }, { prioridade: "p1" }, { prioridade: "P2" }] },
    { iniciada_em: "2026-10-05T05:00:00Z", achados: [{ prioridade: "P1" }] },
  ];
  assert.equal(contarP1(r, agora), 2);
  assert.equal(inicioDoDiaBrasilia(new Date("2026-10-07T02:00:00Z")).toISOString(), "2026-10-06T03:00:00.000Z");
  assert.equal(inicioDoDiaBrasilia(agora).toISOString(), "2026-10-07T03:00:00.000Z");
});

test("prompt do chat leva regras, briefing, rondas e ordens", () => {
  const s = systemChat(AGENTES[1], [{ id: "r", agente_slug: "bruno", iniciada_em: "2026-10-07T05:00:00Z", concluida_em: null, status: "alerta", resumo: "Build quebrado", achados: [], link_sessao: null }], [{ id: "o", agente_slug: "bruno", texto: "Conferir deploy", criada_em: "", status: "pendente", resposta: null }]);
  for (const t of ["imóveis mobiliados", "Caução", "Nunca invente", "próxima ronda", "Build quebrado", "Conferir deploy", "Briefing."]) assert.ok(s.includes(t), t);
});

test("histórico vira turnos alternados começando por user", () => {
  const c = (papel: Conversa["papel"], texto: string): Conversa => ({ id: texto, agente_slug: "bruno", papel, autor_slug: null, texto, criado_em: "" });
  const ms = montarMensagens([c("agente", "a0"), c("daniel", "d1"), c("daniel", "d2"), c("agente", "a1"), c("sistema", "s")], "nova");
  assert.deepEqual(ms.map((m) => m.role), ["user", "assistant", "user"]);
  assert.equal(ms[0].content, "d1\n\nd2");
  assert.equal(ms[2].content, "nova");
});

test("API: não-admin recebe 403 e nada é gravado nem enviado ao modelo", async () => {
  const { d, gravadas, chamadas } = fake({ adminId: async () => null });
  assert.equal((await responderChat(d, { slug: "bruno", texto: "oi" })).status, 403);
  assert.equal((await responderReuniao(d, { pauta: "x", participantes: ["bruno"] })).status, 403);
  assert.equal(gravadas.length + chamadas.length, 0);
});

test("API: limite de 60 por dia", async () => {
  const { d, chamadas } = fake({ perguntasHoje: async () => 60 });
  const r = await responderChat(d, { slug: "bruno", texto: "oi" });
  assert.equal(r.status, 429);
  assert.match(String(r.body.erro), /60 perguntas/);
  assert.equal((await responderReuniao(d, { pauta: "x", participantes: ["bruno"] })).status, 429);
  assert.equal(chamadas.length, 0);
  const ok = fake({ perguntasHoje: async () => 59 });
  assert.equal((await responderChat(ok.d, { slug: "bruno", texto: "oi" })).status, 200);
});

test("API chat: grava pergunta e resposta, 1000 tokens", async () => {
  const { d, gravadas, chamadas } = fake();
  const r = await responderChat(d, { slug: "bruno", texto: " Como está o build? " });
  assert.equal(r.status, 200);
  assert.equal(r.body.resposta, "Tudo certo por aqui.");
  assert.deepEqual(gravadas.map((g) => g.papel), ["daniel", "agente"]);
  assert.equal(chamadas[0].maxTokens, 1000);
  assert.equal((await responderChat(d, { slug: "nao-existe", texto: "oi" })).status, 404);
  assert.equal((await responderChat(d, { slug: "bruno", texto: "" })).status, 400);
});

test("API chat: modelo fora do ar → 502 amigável, pergunta conta no limite", async () => {
  const { d, gravadas } = fake({ modelo: async () => { throw new Error("timeout"); } });
  const r = await responderChat(d, { slug: "bruno", texto: "oi" });
  assert.equal(r.status, 502);
  assert.match(String(r.body.erro), /deixe uma ordem/);
  assert.deepEqual(gravadas.map((g) => g.papel), ["daniel"]);
});

test("API reunião: Moacir entra sempre e fala por último; ata sem agente", async () => {
  const { d, gravadas, chamadas } = fake();
  const r = await responderReuniao(d, { pauta: "Plano da semana", participantes: ["bruno", "viva"] });
  assert.equal(r.status, 200);
  const falas = r.body.falas as { slug: string }[];
  assert.deepEqual(falas.map((f) => f.slug), ["bruno", "moacir"]);
  assert.equal(chamadas[0].maxTokens, 1500);
  assert.equal(chamadas[0].json, true);
  assert.ok(!chamadas[0].system.includes("slug: viva"), "planejado não participa");
  const ata = gravadas.find((g) => g.papel === "sistema");
  assert.equal(ata?.agente_slug, null);
  assert.match(ata?.texto ?? "", /Pauta: Plano da semana[\s\S]*Bruno: Build ok\.[\s\S]*Bruno — Rodar QA/);
});

test("API reunião: JSON inválido → fallback amigável (200), sem ata", async () => {
  for (const ruim of ["isto não é json", '{"falas":"x"}', '{"falas":[{"slug":"intruso","texto":"oi"}],"consolidado":{"texto":"x","passos":[]}}']) {
    const { d, gravadas } = fake({ modelo: async () => ruim });
    const r = await responderReuniao(d, { pauta: "x", participantes: ["bruno"] });
    assert.equal(r.status, 200);
    assert.equal(r.body.fallback, true);
    assert.deepEqual(r.body.falas, []);
    assert.match(String((r.body.consolidado as { texto: string }).texto), /Não consegui montar a ata/);
    assert.equal(gravadas.filter((g) => g.papel === "sistema").length, 0);
  }
  assert.equal(lerReuniao("```json\n{\"falas\":[{\"slug\":\"bruno\",\"texto\":\"ok\"}],\"consolidado\":{\"texto\":\"t\",\"passos\":[]}}\n```", ["bruno"])?.falas.length, 1);
});

test("API reunião: precisa de alguém além do Moacir", async () => {
  const { d } = fake();
  assert.equal((await responderReuniao(d, { pauta: "x", participantes: [] })).status, 400);
});

test("retrato: 'temos algum cliente?' — contagens reais, hora da consulta, sem dado pessoal", () => {
  const t = retratoEmTexto(RETRATO);
  assert.match(t, /dados de 07\/10 08:15/); // 11:15 UTC = 08:15 em Brasília
  assert.match(t, /Cadastros: 9 \(proprietários 5, inquilinos 3, admins 1\); destes, 9 parecem contas de teste/);
  assert.match(t, /Imóveis: 3 \(publicados 2\)/);
  assert.match(t, /Pedidos de moradia: 0/);
  assert.match(t, /Contratos por status: nenhum/);
  assert.match(t, /Chamados abertos por prioridade: p2: 1/);
  assert.doesNotMatch(t, /@/, "nenhum e-mail no retrato");
});

test("retrato: 'o que rodou de madrugada?' — lista as rondas da tabela, ou diz que não há", () => {
  assert.match(retratoEmTexto(RETRATO), /nenhuma ronda registrada na Central ainda/);
  const com = retratoEmTexto({ ...RETRATO, rondas: [{ agente: "Bruno", status: "ok", em: "2026-10-07T05:53:00Z", resumo: "Varredura sem achados." }] });
  assert.match(com, /07\/10 02:53 — Bruno \(ok\): Varredura sem achados\./);
  assert.match(com, /Próxima ronda de cada agente ativo: Bruno: amanhã 02:52 Brasília/);
  assert.match(retratoEmTexto(null), /indisponível/);
});

test("retrato entra no prompt do chat e da reunião, com a regra de citar a hora", async () => {
  const { d, chamadas } = fake();
  await responderChat(d, { slug: "bruno", texto: "Temos algum cliente?" });
  await responderReuniao(d, { pauta: "Clientes", participantes: ["bruno"] });
  for (const c of chamadas) {
    assert.match(c.system, /RETRATO DO MOMENTO \(dados de/);
    assert.match(c.system, /cite "dados de <hora>"/);
    assert.match(c.system, /não está no retrato/);
  }
  // Falha na consulta não derruba o chat: o prompt diz que o retrato está indisponível.
  const sem = fake({ retrato: async () => { throw new Error("x"); } });
  assert.equal((await responderChat(sem.d, { slug: "bruno", texto: "oi" })).status, 200);
  assert.match(sem.chamadas[0].system, /indisponível/);
});
