/*
  Central de Agentes v2 — regras da tela. Roda: node --test src/lib/agentes/painel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Agente, Ronda } from "./central.ts";
import {
  CAMADAS,
  atencaoDaCamada,
  corDaRonda,
  fluxosDaRede,
  indicadores,
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
  assert.deepEqual(indicadores(agentes, rondas, agora), { ativos: 2, rondas24h: 2, falhas: 1, p1: 2 });
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
