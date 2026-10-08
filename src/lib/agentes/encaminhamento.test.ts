/*
  Encaminhamento entre agentes (0087) e Rede ao vivo REAL.
  Roda: node --test src/lib/agentes/encaminhamento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { encaminhamentoUrgente, textoDisparo, type Ordem } from "./central.ts";
import { dispararEncaminhamentos, type DepsEncaminhamento } from "./motor.ts";
import { alvoDaRonda, lerDeploys, lerPrs, linhasAcesas, montarEventos, quemPediu, type FontesRede } from "./eventos.ts";
import { nosDaRede } from "./painel.ts";
import { PREFIXO_MOACIR } from "./gerente.ts";

type Candidata = Awaited<ReturnType<DepsEncaminhamento["candidatas"]>>[number];
const ordem = (id: string, extra: Partial<Candidata> = {}): Candidata => ({
  id,
  agente_slug: "otavio",
  texto: `Encaminhado por Bruno (P1): achado ${id}`,
  status: "pendente",
  origem_slug: "bruno",
  retorno_de: null,
  prioridade: "P1",
  disparada_em: null,
  disparo_erro: null,
  ...extra,
});

function deps(candidatas: Candidata[], o: { limite?: number; token?: boolean; reservadas?: Set<string>; falhaDisparo?: boolean } = {}) {
  const disparos: { url: string; texto: string }[] = [];
  const registros: Record<string, { sessao_url?: string | null; erro?: string }> = {};
  let limite = o.limite ?? 20;
  const d: DepsEncaminhamento = {
    candidatas: async () => candidatas,
    agentes: async () => [
      { slug: "bruno", nome: "Bruno", status: "ativo", trigger_id: "trig_b" },
      { slug: "otavio", nome: "Otávio", status: "ativo", trigger_id: "trig_o" },
      { slug: "caio", nome: "Caio", status: "planejado", trigger_id: null },
    ],
    reservar: async (id) => !(o.reservadas?.has(id) ?? false),
    consumirDisparo: async () => limite-- > 0,
    registrarDisparo: async (id, r) => void (registros[id] = r),
    token: () => (o.token === false ? null : "tok"),
    disparar: async (url, _t, texto) => {
      if (o.falhaDisparo) throw new Error("HTTP 500");
      disparos.push({ url, texto });
      return { sessao_url: "https://claude.ai/code/session_x" };
    },
  };
  return { d, disparos, registros };
}

test("achado P1 encaminhado ao Otávio: dispara a rotina dele na hora, com a origem no texto", async () => {
  const { d, disparos, registros } = deps([ordem("o1")]);
  const r = await dispararEncaminhamentos(d);
  assert.deepEqual(r.disparadas, ["o1"]);
  assert.equal(disparos.length, 1);
  assert.match(disparos[0].url, /routines\/trig_o\/fire$/);
  assert.match(disparos[0].texto, /encaminhamento urgente\) — ordem o1 encaminhada por Bruno/);
  assert.match(disparos[0].texto, /ordens_pendentes\('otavio'\)/);
  assert.equal(registros.o1.sessao_url, "https://claude.ai/code/session_x");
});

test("só P0/P1 de encaminhamento disparam: P2, retorno, já disparada, sem origem e não pendente ficam para a ronda", async () => {
  const fila = [
    ordem("p2", { prioridade: "P2" }),
    ordem("ret", { retorno_de: "o0" }),
    ordem("ja", { disparada_em: "2026-10-07T10:00:00Z" }),
    ordem("err", { disparo_erro: "x" }),
    ordem("dan", { origem_slug: null }),
    ordem("lida", { status: "lida" }),
    ordem("p0", { prioridade: "p0" }),
  ];
  const { d, disparos } = deps(fila);
  const r = await dispararEncaminhamentos(d);
  assert.deepEqual(r.disparadas, ["p0"]);
  assert.equal(disparos.length, 1);
  assert.equal(encaminhamentoUrgente(ordem("x", { prioridade: "P1" })), true);
  assert.equal(encaminhamentoUrgente(ordem("x", { prioridade: null })), false);
});

test("Moacir e Despachante nunca são disparados por encaminhamento", async () => {
  const a = deps([ordem("m1", { agente_slug: "moacir" })]);
  const base = a.d.agentes;
  a.d.agentes = async () => [...(await base()), { slug: "moacir", nome: "Moacir", status: "ativo", trigger_id: "trig_m" }];
  const r = await dispararEncaminhamentos(a.d);
  assert.deepEqual(r.disparadas, []);
  assert.equal(a.disparos.length, 0);
  assert.equal(a.registros.m1.erro, "agente não é disparado por ordem");
});

test("limite diário, sem token, sem rotina e falha: a ordem fica gravada com o motivo, nada some", async () => {
  const a = deps([ordem("a1"), ordem("a2")], { limite: 1 });
  const ra = await dispararEncaminhamentos(a.d);
  assert.deepEqual(ra.disparadas, ["a1"]);
  assert.match(a.registros.a2.erro!, /limite de disparos \(6\/h por agente, 30\/dia\)/);

  const b = deps([ordem("b1")], { token: false });
  await dispararEncaminhamentos(b.d);
  assert.equal(b.registros.b1.erro, "sem token da rotina");

  const c = deps([ordem("c1", { agente_slug: "caio" })]);
  await dispararEncaminhamentos(c.d);
  assert.equal(c.registros.c1.erro, "sem rotina para disparar");

  const e = deps([ordem("e1")], { falhaDisparo: true });
  const re = await dispararEncaminhamentos(e.d);
  assert.deepEqual(re.falhas, [{ id: "e1", motivo: "HTTP 500" }]);
});

test("disparo duplo evitado: ordem já reservada por outra aba/cron não dispara de novo", async () => {
  const { d, disparos } = deps([ordem("r1")], { reservadas: new Set(["r1"]) });
  const r = await dispararEncaminhamentos(d);
  assert.equal(disparos.length, 0);
  assert.deepEqual(r, { disparadas: [], falhas: [] });
});

test("até 5 por vez", async () => {
  const { d, disparos } = deps(Array.from({ length: 8 }, (_, i) => ordem(`m${i}`)));
  await dispararEncaminhamentos(d);
  assert.equal(disparos.length, 5);
});

test("texto do Executar agora (Daniel) não muda", () => {
  assert.match(textoDisparo({ id: "x", agente_slug: "renato", texto: "t" }), /^Disparo da Central de Agentes \(Executar agora\) — ordem x do Daniel\./);
});

// ── Rede ao vivo real ──────────────────────────────────────────────────────
const agora = new Date("2026-10-07T20:00:00Z");
const h = (n: number) => new Date(agora.getTime() - n * 3600_000).toISOString();
const nomes = { bruno: "Bruno", otavio: "Otávio", renato: "Renato", moacir: "Moacir", viva: "Viva", helena: "Helena" };
const base = (f: Partial<FontesRede>): FontesRede => ({ nomes, rondas: [], ordens: [], chamados: [], prs: [], deploys: [], ...f });

test("ronda com 'para' vira 'Bruno → Otávio: 2 achados (P1, P2)'; ronda velha (25 h) não entra", () => {
  const ev = montarEventos(
    base({
      rondas: [
        { agente_slug: "bruno", iniciada_em: h(1), status: "alerta", link_sessao: null, achados: [{ prioridade: "P1", titulo: "a", para: "otavio" } as never, { prioridade: "P2", titulo: "b", para: "Otavio " } as never, { prioridade: "P3", titulo: "c" }] },
        { agente_slug: "helena", iniciada_em: h(25), status: "ok", link_sessao: null, achados: [] },
      ],
    }),
    agora
  );
  const textos = ev.map((e) => e.texto);
  assert.ok(textos.includes("Bruno → Otávio: 2 achados (P1, P2)"), textos.join(" | "));
  assert.ok(textos.includes("Bruno fez ronda com alerta: 3 achados (P1, P2, P3)"));
  assert.ok(!textos.some((t) => t.includes("Helena")));
  const ronda = ev.find((e) => e.tipo === "ronda")!;
  assert.deepEqual([ronda.de, ronda.para], ["bruno", "fila"]);
});

test("ordens: criada (Daniel/Moacir), lida, concluída, retorno; encaminhamento de achado não duplica", () => {
  const ev = montarEventos(
    base({
      ordens: [
        { agente_slug: "renato", texto: "corrija X", criada_em: h(3), atualizada_em: h(1), status: "concluida", origem_slug: null, origem_ronda: null, retorno_de: null, prioridade: null, disparada_em: h(3) },
        { agente_slug: "otavio", texto: `${PREFIXO_MOACIR}veja Y`, criada_em: h(2), atualizada_em: h(2), status: "pendente", origem_slug: null, origem_ronda: null, retorno_de: null, prioridade: null, disparada_em: null },
        { agente_slug: "otavio", texto: "Encaminhado por Bruno (P1): a", criada_em: h(1), atualizada_em: h(0.5), status: "lida", origem_slug: "bruno", origem_ronda: "r1", retorno_de: null, prioridade: "P1", disparada_em: h(1) },
        { agente_slug: "bruno", texto: "Retorno de Otávio…", criada_em: h(0.2), atualizada_em: h(0.2), status: "pendente", origem_slug: "otavio", origem_ronda: "r2", retorno_de: "o1", prioridade: null, disparada_em: null },
      ],
    }),
    agora
  );
  const textos = ev.map((e) => e.texto);
  assert.ok(textos.includes("Daniel → Renato: ordem criada (disparo na hora)"), textos.join(" | "));
  assert.ok(textos.includes("Renato → Daniel: ordem concluída"));
  assert.ok(textos.includes("Moacir → Otávio: ordem criada"));
  assert.ok(textos.includes("Otávio leu a ordem de Bruno"));
  assert.ok(textos.includes("Otávio → Bruno: retorno do que foi encaminhado"));
  assert.ok(!textos.some((t) => t.startsWith("Bruno → Otávio: ordem criada")), "encaminhamento de achado já aparece na ronda");
  assert.equal(quemPediu({ origem_slug: null, texto: `${PREFIXO_MOACIR}x` }), "moacir");
});

test("chamados, PRs e deploys; tudo do mais novo para o mais antigo", () => {
  const ev = montarEventos(
    base({
      chamados: [
        { acao: "aberto", ator_tipo: "usuario", criado_em: h(5), numero: "VN-000200" },
        { acao: "respondido_viva", ator_tipo: "ia", criado_em: h(4.9), numero: "VN-000200" },
        { acao: "respondido", ator_tipo: "admin", criado_em: h(3), numero: "VN-000201" },
        { acao: "sugestao_ia", ator_tipo: "ia", criado_em: h(3), numero: "VN-000201" },
      ],
      prs: lerPrs([
        { number: 304, title: "Viva com autonomia", html_url: "https://github.com/x/y/pull/304", created_at: h(2), merged_at: null },
        { number: 303, title: "Luana", html_url: "https://github.com/x/y/pull/303", created_at: h(30), merged_at: h(1) },
        { lixo: true },
      ]),
      deploys: lerDeploys([{ sha: "abcdef1234", created_at: h(0.5), environment: "Production" }]),
    }),
    agora
  );
  assert.deepEqual(
    ev.map((e) => e.texto),
    ["Deploy em Production (abcdef1)", "Daniel mesclou o PR #303", "PR #304 aberto: Viva com autonomia", "Equipe respondeu VN-000201", "Viva deixou a resposta sugerida de VN-000201 para você aprovar", "Viva respondeu VN-000200 sozinha", "Chamado VN-000200 aberto"]
  );
  assert.equal(ev.find((e) => e.tipo === "pr")!.link, "https://github.com/x/y/pull/303");
  assert.deepEqual(lerPrs({ message: "rate limit" }), []);
});

test("linha só acende onde houve evento: uma por par, com o tipo do mais recente; nós site/github/viva existem", () => {
  const linhas = linhasAcesas([
    { em: h(1), de: "bruno", para: "otavio", tipo: "encaminhamento", texto: "" },
    { em: h(0.5), de: "otavio", para: "bruno", tipo: "retorno", texto: "" },
    { em: h(2), de: "site", para: "viva", tipo: "chamado", texto: "" },
    { em: h(2), de: "x", para: "x", tipo: "ronda", texto: "" },
  ]);
  assert.equal(linhas.length, 2);
  const bo = linhas.find((l) => [l.de, l.para].sort().join() === "bruno,otavio")!;
  assert.equal(bo.quantos, 2);
  assert.equal(bo.tipo, "retorno");
  const ids = nosDaRede([{ slug: "viva", nome: "Viva", status: "ativo" }]).map((n) => n.id);
  for (const id of ["site", "github", "viva", "daniel"]) assert.ok(ids.includes(id), id);
  assert.equal(alvoDaRonda("moacir"), "daniel");
  assert.equal(alvoDaRonda("helena"), "pendencias");
});

test("migração 0087: só colunas novas + registrar_ronda com o mesmo formato, sem DROP e sem NOTICE", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/0087_encaminhamento_entre_agentes.sql", import.meta.url), "utf8");
  const codigo = sql.replace(/--.*$/gm, "");
  assert.doesNotMatch(codigo, /\bdrop\b/i);
  assert.doesNotMatch(codigo, /\bif not exists\b(?![^$]*\$\$)/i, "if not exists fora do DO gera NOTICE");
  assert.match(codigo, /create or replace function public\.registrar_ronda\(\s*p_slug text, p_inicio timestamptz, p_fim timestamptz, p_status text,\s*p_resumo text, p_achados jsonb default '\[\]'::jsonb, p_ordens uuid\[\] default '\{\}', p_link text default null\s*\)/);
  assert.match(codigo, /g\.status = 'ativo' and g\.slug <> p_slug/, "encaminhamento só para agente ativo e nunca para si mesmo");
  assert.match(codigo, /o\.retorno_de is null/, "retorno não gera outro retorno");
  assert.match(codigo, /limit 10/);
  assert.match(codigo, /grant execute on function public\.registrar_ronda\([^)]*\) to service_role/);
});

test("Ordem aceita as colunas da 0087", () => {
  const o: Ordem = { id: "1", agente_slug: "a", texto: "t", criada_em: h(1), status: "pendente", resposta: null, origem_slug: "b", origem_ronda: "r", retorno_de: null, prioridade: "P1" };
  assert.equal(o.prioridade, "P1");
});
