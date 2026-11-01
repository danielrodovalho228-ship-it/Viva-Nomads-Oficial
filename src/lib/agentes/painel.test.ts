/*
  Central de Agentes v2 — regras da tela. Roda: node --test src/lib/agentes/painel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Agente, Conversa, Ronda } from "./central.ts";
import {
  CAMADAS,
  FLUXOS,
  atencaoDaCamada,
  corDaRonda,
  fluxosDaRede,
  indicadores,
  mesclarConversas,
  nosDaRede,
  resumoCurto,
  roteiroBriefing,
  rondaRecente,
  ultimaPorAgente,
} from "./painel.ts";

const agora = new Date("2026-10-07T15:00:00Z");
const ag = (slug: string, nome: string, status: Agente["status"] = "ativo", esquadrao: Agente["esquadrao"] = "tecnologia"): Agente => ({
  slug, nome, cargo: `cargo de ${nome}`, esquadrao, rotina_texto: "Todo dia 06:13 Brasília", trigger_id: null, status, briefing: "", ordem: 0,
});
let n = 0;
const ronda = (slug: string, minAtras: number, status: Ronda["status"] = "ok", resumo = "tudo certo", achados: Ronda["achados"] = []): Ronda => ({
  id: `r${n++}`, agente_slug: slug, iniciada_em: new Date(agora.getTime() - minAtras * 60_000).toISOString(), concluida_em: null, status, resumo, achados, link_sessao: null,
});

test("última ronda por agente, em qualquer ordem", () => {
  const u = ultimaPorAgente([ronda("bruno", 300), ronda("bruno", 10, "alerta"), ronda("otavio", 50)]);
  assert.equal(u.bruno.status, "alerta");
  assert.equal(Object.keys(u).length, 2);
  assert.equal(corDaRonda(u.otavio), "ok");
  assert.equal(corDaRonda(undefined), "sem");
});

test("nó pisca só com ronda de menos de 15 min", () => {
  assert.equal(rondaRecente(ronda("x", 14), agora), true);
  assert.equal(rondaRecente(ronda("x", 16), agora), false);
  assert.equal(rondaRecente(undefined, agora), false);
});

test("resumo de card: 160 caracteres, sem cortar palavra", () => {
  assert.equal(resumoCurto("curto"), "curto");
  const longo = "palavra ".repeat(40);
  const r = resumoCurto(longo);
  assert.ok(r.length <= 161, String(r.length));
  assert.ok(r.endsWith("palavra…"));
});

test("indicadores: ativos, rondas 24 h, falhas e P1 só das últimas rondas", () => {
  const agentes = [ag("bruno", "Bruno"), ag("otavio", "Otávio"), ag("viva", "Viva", "planejado", "plataforma")];
  const rondas = [
    ronda("bruno", 30, "falhou", "x", [{ prioridade: "P1", titulo: "a" }, { prioridade: "p1", titulo: "b" }]),
    ronda("bruno", 2000, "ok", "x", [{ prioridade: "P1", titulo: "velho" }]),
    ronda("otavio", 60),
  ];
  assert.deepEqual(indicadores(agentes, rondas, agora), { ativos: 2, rondas24h: 2, agentes24h: 2, falhas: 1, p1: 2 });
});

test("rede: o Renato recebe o pacote do Otávio e entrega PRs ao Daniel", () => {
  const fl = fluxosDaRede(nosDaRede([ag("otavio", "Otávio"), ag("renato", "Renato"), ag("moacir", "Moacir")]));
  assert.ok(fl.some(([a, b]) => a === "otavio" && b === "renato"));
  assert.ok(fl.some(([a, b]) => a === "renato" && b === "daniel"));
  assert.ok(fl.some(([a, b]) => a === "moacir" && b === "renato"));
});

test("rede: só agentes ativos do banco; fluxos sem nó faltando", () => {
  const nos = nosDaRede([ag("bruno", "Bruno"), ag("otavio", "Otávio"), ag("marina", "Marina", "pausado")]);
  const ids = nos.map((x) => x.id);
  assert.ok(ids.includes("bruno") && ids.includes("fila") && ids.includes("daniel"));
  assert.ok(!ids.includes("marina"));
  const fl = fluxosDaRede(nos);
  assert.ok(fl.some(([a, b]) => a === "bruno" && b === "fila"));
  assert.ok(fl.every(([a, b]) => ids.includes(a) && ids.includes(b)));
  for (const no of nos) for (const v of [...no.pos, ...no.posEstreito]) assert.ok(v >= 0 && v <= 1, no.id);
});

test("briefing usa o resumo REAL da última ronda e avisa quem não tem ronda", () => {
  const agentes = [ag("bruno", "Bruno"), ag("marina", "Marina"), ag("viva", "Viva", "planejado")];
  const passos = roteiroBriefing(agentes, [ronda("bruno", 120, "alerta", "Achei 2 erros na Vercel.", [{ prioridade: "P1", titulo: "500 na busca" }])], agora);
  assert.deepEqual(passos.map((p) => p.no), ["bruno", "marina", "daniel"]);
  assert.match(passos[0].texto, /Achei 2 erros na Vercel\./);
  assert.match(passos[0].texto, /há 2 h/);
  assert.match(passos[0].texto, /1 achado P1/);
  assert.equal(passos[0].cor, "alerta");
  assert.match(passos[1].texto, /Ainda sem ronda/);
});

test("Raio-X: ponto de atenção vem dos achados P0–P2 reais da área", () => {
  const banco = CAMADAS.find((c) => c.id === "banco")!;
  const vitrine = CAMADAS.find((c) => c.id === "vitrine")!;
  const rondas = [
    ronda("bruno", 20, "alerta", "x", [
      { prioridade: "P1", titulo: "Função sem search_path no Supabase" },
      { prioridade: "P2", titulo: "Sitemap com URL 404" },
      { prioridade: "P3", titulo: "Migração antiga sem comentário" },
    ]),
    ronda("rafael", 40, "ok", "x", [{ prioridade: "P2", titulo: "Título da home longo" }]),
  ];
  const b = atencaoDaCamada(banco, rondas);
  assert.deepEqual(b.map((p) => p.titulo), ["Função sem search_path no Supabase"]);
  const v = atencaoDaCamada(vitrine, rondas).map((p) => p.titulo);
  assert.ok(v.includes("Sitemap com URL 404"));
  assert.ok(v.includes("Título da home longo"), "achado sem palavra de outra camada fica com quem cuida");
  assert.ok(!v.some((t) => /Migração antiga/.test(t)), "P3 não entra");
  assert.deepEqual(atencaoDaCamada(CAMADAS.find((c) => c.id === "parceiros")!, rondas), []);
});

const cv = (id: string, papel: Conversa["papel"], texto: string, slug = "bruno"): Conversa => ({ id, agente_slug: slug, papel, autor_slug: null, texto, criado_em: "" });

test("mesclarConversas: otimistas p-/r-/t- não duplicam o que já foi gravado", () => {
  const salvas = [cv("u1", "daniel", "oi"), cv("u2", "agente", "passo"), cv("u3", "agente", "resposta")];
  const extra = [cv("p-1", "daniel", "oi"), cv("t-1-0", "agente", "passo"), cv("r-1", "agente", "resposta")];
  assert.deepEqual(mesclarConversas(salvas, extra).map((c) => c.id), ["u1", "u2", "u3"]);
});

test("mesclarConversas: mensagem ainda não gravada continua na tela", () => {
  const out = mesclarConversas([cv("u1", "daniel", "oi")], [cv("p-1", "daniel", "oi"), cv("p-2", "daniel", "nova")]);
  assert.deepEqual(out.map((c) => c.id), ["u1", "p-2"]);
});

test("mesclarConversas: pergunta repetida de verdade não some", () => {
  const out = mesclarConversas([cv("u1", "daniel", "oi")], [cv("p-1", "daniel", "oi"), cv("p-2", "daniel", "oi")]);
  assert.deepEqual(out.map((c) => c.id), ["u1", "p-2"]);
});

test("mesclarConversas: mesmo texto em outro agente não é duplicata", () => {
  const out = mesclarConversas([cv("u1", "daniel", "oi", "bruno")], [cv("p-1", "daniel", "oi", "luana")]);
  assert.equal(out.length, 2);
});

test("rede: Rogério é nó de dono ao lado do Daniel e recebe o relatório do Moacir", () => {
  const ids = nosDaRede([]).map((n) => n.id);
  assert.ok(ids.includes("daniel") && ids.includes("rogerio"));
  assert.ok(FLUXOS.some(([a, b]) => a === "moacir" && b === "rogerio"));
});

test("E335: a capa e os cartões leem a mesma fonte — última ronda de cada agente e rondas de 24 h lidas à parte", async () => {
  const { juntarUltimas, contarRondas24h, rotuloRondas24h } = await import("./painel.ts");
  const { duracao } = await import("./central.ts");
  const agentes = [ag("renato", "Renato"), ag("bruno", "Bruno"), ag("otavio", "Otávio")];
  // A janela das 200 mais recentes só tem o Renato (90 por dia); Bruno e Otávio rodaram há 2 semanas.
  const janela = Array.from({ length: 5 }, (_, i) => ({ ...ronda("renato", 10 + i * 15), id: `r${i}` }));
  const bruno = { ...ronda("bruno", 20_000), id: "b1" };
  const otavio = { ...ronda("otavio", 20_100), id: "o1" };
  const rondas = juntarUltimas(janela, [janela[0], bruno, otavio]);
  assert.equal(rondas.length, 7, "sem repetir a do Renato");
  const ult = ultimaPorAgente(rondas);
  assert.deepEqual(Object.keys(ult).sort(), ["bruno", "otavio", "renato"], "ninguém fica 'Sem ronda ainda'");
  const c24 = contarRondas24h(Array.from({ length: 89 }, () => ({ agente_slug: "renato" })));
  const k = indicadores(agentes, rondas, agora, c24);
  assert.equal(k.rondas24h, 89);
  assert.equal(k.agentes24h, 1);
  assert.equal(rotuloRondas24h(k.agentes24h), "rondas em 24 h · 1 agente");
  assert.equal(rotuloRondas24h(3), "rondas em 24 h · 3 agentes");
  // Ronda gravada só no fim (início = fim): sem duração, nunca "0 s".
  assert.equal(duracao("2026-11-01T09:00:08Z", "2026-11-01T09:00:08Z"), null);
  assert.equal(duracao("2026-11-01T09:00:00Z", "2026-11-01T09:00:42Z"), "42 s");
});

test("E335: carregarCentral lê a última ronda de cada agente e as 24 h à parte; a 0274 dá título real às ordens", async () => {
  const { readFileSync } = await import("node:fs");
  const acoes = readFileSync(new URL("../data/agentes-actions.ts", import.meta.url), "utf8");
  assert.match(acoes, /\.eq\("agente_slug", ag\.slug\)\.order\("iniciada_em", \{ ascending: false \}\)\.limit\(1\)/);
  assert.match(acoes, /\.gte\("iniciada_em", desde24h\)/);
  assert.match(acoes, /juntarUltimas\(/);
  const mig = readFileSync(new URL("../../../supabase/migrations/0274_agentes_titulo_achado.sql", import.meta.url), "utf8");
  const apl = readFileSync(new URL("../../../supabase/producao/aplicar-0274.sql", import.meta.url), "utf8");
  for (const sql of [mig, apl]) {
    assert.match(sql, /p->>'assunto'/);
    assert.match(sql, /public\.agente_achado_texto\(a\.achado\)/);
    assert.match(sql, /insert into public\.agentes_ordens_titulo_0274/);
    assert.doesNotMatch(sql, /\bdelete from\b|\bdrop table\b/i, "a 0274 não apaga nada");
  }
  assert.match(apl, /^begin;/m);
  assert.match(apl, /'0274_agentes_titulo_achado'/);
  assert.match(apl, /^commit;/m);
  const rb = readFileSync(new URL("../../../supabase/producao/rollback/0274_rollback.sql", import.meta.url), "utf8");
  assert.match(rb, /set texto = c\.texto_antes/);
});
