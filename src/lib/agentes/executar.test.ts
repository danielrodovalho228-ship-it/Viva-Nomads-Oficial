/*
  Central de Agentes — "Executar agora" e chat honesto.
  Roda: node --test src/lib/agentes/executar.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  destinoDaOrdem,
  estadoDaOrdem,
  linkDaOrdem,
  LIMITE_DISPAROS_DIA_TOTAL,
  LIMITE_DISPAROS_HORA_AGENTE,
  nomeVarToken,
  pedeAcao,
  prometeAcao,
  textoDisparo,
  URL_DISPARO,
  type Agente,
} from "./central.ts";
import { avisoOrdemRegistrada, executarAgora, responderChat, type Deps, type DepsExecutar } from "./motor.ts";

const ag = (slug: string, nome: string, extra: Partial<Agente> = {}): Agente => ({
  slug,
  nome,
  cargo: "Cargo",
  esquadrao: "tecnologia",
  rotina_texto: "Todo dia 02:52 Brasília",
  trigger_id: `trig_${slug}`,
  status: "ativo",
  briefing: "Briefing.",
  ordem: 1,
  ...extra,
});
const AGENTES = [ag("moacir", "Moacir", { trigger_id: null }), ag("bruno", "Bruno"), ag("renato", "Renato"), ag("viva", "Viva", { trigger_id: null })];

test("pedido de ação x pergunta", () => {
  for (const t of ["corrija o /conferir", "Aplica a 0083", "abra um PR com isso", "pode rodar o lab?", "dispare o Renato", "mande o e-mail", "apague a ordem"]) assert.ok(pedeAcao(t), t);
  for (const t of ["como está o build?", "o que você achou na última ronda?", "quantos clientes temos?", "o Renato corrigiu?"]) assert.ok(!pedeAcao(t), t);
});

test("correção vai para o Renato; resto fica com o agente", () => {
  assert.equal(destinoDaOrdem("bruno", "corrija o erro do sitemap", AGENTES), "renato");
  assert.equal(destinoDaOrdem("bruno", "refaça a varredura de segurança", AGENTES), "bruno");
  assert.equal(destinoDaOrdem("renato", "corrija X", AGENTES), "renato");
  // Renato sem rotina → não desvia.
  assert.equal(destinoDaOrdem("bruno", "corrija X", AGENTES.map((a) => (a.slug === "renato" ? { ...a, trigger_id: null } : a))), "bruno");
});

test("promessa do modelo é pega", () => {
  for (const t of ["Vou aplicar a migração agora.", "Aplico com a sua aprovação.", "Já corrigi o bug.", "Posso abrir o PR em seguida."]) assert.ok(prometeAcao(t), t);
  for (const t of ["A última ronda achou 2 itens P2.", "O Renato abre o PR quando for disparado."]) assert.ok(!prometeAcao(t), t);
});

test("estado da ordem: aguardando → enviada → em execução → concluída; link da ronda vence o da sessão", () => {
  assert.equal(estadoDaOrdem({ status: "pendente" }), "aguardando");
  assert.equal(estadoDaOrdem({ status: "pendente", disparada_em: "x", sessao_url: "https://claude.ai/code/s" }), "enviada");
  assert.equal(estadoDaOrdem({ status: "pendente", disparada_em: "x", disparo_erro: "HTTP 401" }), "falhou");
  assert.equal(estadoDaOrdem({ status: "lida", disparada_em: "x" }), "em_execucao");
  assert.equal(estadoDaOrdem({ status: "concluida" }), "concluida");
  const o = { id: "o1", sessao_url: "https://claude.ai/code/s1" };
  assert.equal(linkDaOrdem(o, []), "https://claude.ai/code/s1");
  assert.equal(linkDaOrdem(o, [{ ordens_atendidas: ["o1"], link_sessao: "https://github.com/x/pull/9" }]), "https://github.com/x/pull/9");
  assert.equal(linkDaOrdem({ id: "o2", sessao_url: "javascript:alert(1)" }, []), null);
});

test("token por agente só no servidor; disparo aponta para a ordem do banco", () => {
  assert.equal(nomeVarToken("renato"), "AGENTE_TOKEN_RENATO");
  assert.equal(nomeVarToken("sérgio"), "AGENTE_TOKEN_SERGIO");
  assert.equal(URL_DISPARO("trig_01X"), "https://api.anthropic.com/v1/claude_code/routines/trig_01X/fire");
  const t = textoDisparo({ id: "o1", agente_slug: "renato", texto: "corrija X" });
  assert.match(t, /ordens_pendentes\('renato'\)/);
  assert.match(t, /p_ordens incluindo 'o1'/);
  // Nada de token/variável no cliente.
  const cliente = readFileSync(new URL("../../app/(dashboard)/admin/agentes/central-client.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(cliente, /AGENTE_TOKEN|process\.env/);
});

function fakeExec(over: Partial<DepsExecutar> = {}) {
  const log: string[] = [];
  const d: DepsExecutar = {
    adminId: async () => "admin-1",
    agentes: async () => AGENTES,
    consumirDisparo: async () => true,
    criarOrdem: async (s, t) => (log.push(`ordem:${s}:${t}`), "o1"),
    registrarDisparo: async (id, r) => void log.push(`disparo:${id}:${r.sessao_url ?? r.erro}`),
    token: () => "tok",
    disparar: async (url, tok, texto) => (log.push(`fire:${url}:${tok}:${texto.includes("o1")}`), { sessao_url: "https://claude.ai/code/s1" }),
    ...over,
  };
  return { d, log };
}

test("Executar agora: grava, dispara e guarda o link", async () => {
  const { d, log } = fakeExec();
  const r = await executarAgora(d, { slug: "renato", texto: " corrija X " });
  assert.equal(r.status, 200);
  assert.equal(r.body.sessao_url, "https://claude.ai/code/s1");
  assert.deepEqual(log, ["ordem:renato:corrija X", "fire:https://api.anthropic.com/v1/claude_code/routines/trig_renato/fire:tok:true", "disparo:o1:https://claude.ai/code/s1"]);
});

test("Executar agora: só admin, limite de 20, agente sem rotina, sem token e falha não perdem a ordem", async () => {
  assert.equal((await executarAgora(fakeExec({ adminId: async () => null }).d, { slug: "renato", texto: "x" })).status, 403);
  const lim = fakeExec({ consumirDisparo: async () => false });
  assert.equal((await executarAgora(lim.d, { slug: "renato", texto: "x" })).status, 429);
  assert.deepEqual(lim.log, []);
  assert.equal((await executarAgora(fakeExec().d, { slug: "viva", texto: "x" })).status, 409);
  assert.equal((await executarAgora(fakeExec().d, { slug: "renato", texto: "" })).status, 400);
  const sem = fakeExec({ token: () => null });
  const r1 = await executarAgora(sem.d, { slug: "renato", texto: "x" });
  assert.equal(r1.status, 503);
  assert.deepEqual(sem.log, ["ordem:renato:x", "disparo:o1:sem token da rotina"]);
  const cai = fakeExec({ disparar: async () => Promise.reject(new Error("HTTP 401")) });
  const r2 = await executarAgora(cai.d, { slug: "renato", texto: "x" });
  assert.equal(r2.status, 502);
  assert.equal(r2.body.ordemId, "o1");
  assert.ok(cai.log.includes("disparo:o1:HTTP 401"));
  // Sem disparo imediato, a resposta promete o que de fato acontece (rotina de hora em hora), não "próxima ronda".
  assert.equal(r1.body.aviso, "Ordem registrada — o Moacir aciona Renato em até 1 hora.");
  assert.equal(r2.body.aviso, "Ordem registrada — o Moacir aciona Renato em até 1 hora.");
  assert.doesNotMatch(String(r1.body.erro) + String(r2.body.erro), /próxima ronda/);
  assert.equal(avisoOrdemRegistrada("Bruno"), "Ordem registrada — o Moacir aciona Bruno em até 1 hora.");
});

test("Despachante: Moacir e Despachante nunca são disparados por ordem; limite recebe o agente", async () => {
  const visto: string[] = [];
  const f = fakeExec({ consumirDisparo: async (slug) => (visto.push(slug), true) });
  const com = [...AGENTES, ag("despachante", "Despachante")].map((a) => (a.slug === "moacir" ? { ...a, trigger_id: "trig_moacir" } : a));
  const d = { ...f.d, agentes: async () => com };
  assert.equal((await executarAgora(d, { slug: "moacir", texto: "x" })).status, 409);
  assert.equal((await executarAgora(d, { slug: "despachante", texto: "x" })).status, 409);
  assert.deepEqual(f.log, []);
  assert.deepEqual(visto, []);
  assert.equal((await executarAgora(d, { slug: "renato", texto: "x" })).status, 200);
  assert.deepEqual(visto, ["renato"]);
  assert.equal(LIMITE_DISPAROS_HORA_AGENTE, 6);
  assert.equal(LIMITE_DISPAROS_DIA_TOTAL, 30);
});

test("Despachante: o teto antigo de 20/dia por admin não existe mais (só 6/h por agente e 30/dia)", () => {
  const src = readFileSync(new URL("./central.ts", import.meta.url), "utf8");
  assert.equal(/\bLIMITE_DISPAROS_DIA\b/.test(src), false);
});

function fakeChat(resposta: string) {
  const gravadas: string[] = [];
  let chamouModelo = false;
  const d: Deps = {
    adminId: async () => "admin-1",
    perguntasHoje: async () => 0,
    agentes: async () => AGENTES,
    rondas: async () => [],
    ordensAbertas: async () => [],
    historico: async () => [],
    retrato: async () => null,
    gravar: async (l) => void gravadas.push(...l.map((x) => x.texto)),
    modelo: async () => ((chamouModelo = true), resposta),
  };
  return { d, gravadas, chamou: () => chamouModelo };
}

test("chat honesto: pedido de ação não vai ao modelo e oferece Executar agora para o agente certo", async () => {
  const f = fakeChat("irrelevante");
  const r = await responderChat(f.d, { slug: "moacir", texto: "Aplica a 0083 e corrige o bug do sitemap" });
  assert.equal(r.status, 200);
  assert.equal(f.chamou(), false);
  assert.match(String(r.body.resposta), /precisa de uma sessão real — use Executar agora \(vai para Renato\)/);
  assert.deepEqual(r.body.acao, { slug: "renato", nome: "Renato" });
});

test("chat honesto: promessa do modelo vira a resposta honesta; pergunta normal segue igual", async () => {
  const p = fakeChat("Aplico com a sua aprovação.");
  const r = await responderChat(p.d, { slug: "moacir", texto: "como estamos?" });
  assert.match(String(r.body.resposta), /sessão real/);
  assert.doesNotMatch(p.gravadas.join("\n"), /Aplico com a sua aprovação/);
  const n = fakeChat("Tudo certo: 2 achados P2.");
  const r2 = await responderChat(n.d, { slug: "bruno", texto: "como está o build?" });
  assert.equal(r2.body.resposta, "Tudo certo: 2 achados P2.");
  assert.equal(r2.body.acao, undefined);
});
