import { test } from "node:test";
import assert from "node:assert/strict";
import { kpiInteressados, contarInteressados } from "./kpi-interessados.ts";

const DIA = 24 * 60 * 60 * 1000;
const agora = new Date("2026-10-16T12:00:00Z");
const iso = (diasAtras: number) => new Date(agora.getTime() - diasAtras * DIA).toISOString();

test("zero interessados: nunca só '0' — mostra o período e a próxima ação", () => {
  const k = kpiInteressados(0, 0, { temImovelPublicado: true });
  assert.equal(k.rotulo, "Interessados · últimos 30 dias");
  assert.equal(k.valor, "0");
  assert.match(k.dica, /Compartilhe seu anúncio/);
  assert.equal(k.href, "/dashboard/imoveis");
});

test("zero sem imóvel publicado: a ação é publicar", () => {
  const k = kpiInteressados(0, 0, { temImovelPublicado: false });
  assert.match(k.dica, /Publique seu primeiro anúncio/);
  assert.equal(k.href, "/dashboard/imoveis/novo");
});

test("comparação com os 30 dias anteriores", () => {
  assert.match(kpiInteressados(5, 2, { temImovelPublicado: true }).dica, /3 a mais que nos 30 dias anteriores/);
  assert.match(kpiInteressados(1, 4, { temImovelPublicado: true }).dica, /3 a menos que nos 30 dias anteriores/);
  assert.match(kpiInteressados(2, 2, { temImovelPublicado: true }).dica, /igual aos 30 dias anteriores/);
  assert.match(kpiInteressados(2, 0, { temImovelPublicado: true }).dica, /2 a mais que nos 30 dias anteriores/);
});

test("com interessados o cartão leva à lista, sem texto de 'zero'", () => {
  const k = kpiInteressados(3, 3, { temImovelPublicado: true });
  assert.equal(k.valor, "3");
  assert.equal(k.href, "/dashboard/leads");
  assert.doesNotMatch(k.dica, /Compartilhe/);
});

test("contarInteressados separa 0–30 dias e 30–60 dias; ignora datas inválidas e futuras", () => {
  const r = contarInteressados(
    [iso(1), iso(29), iso(31), iso(59), iso(61), "lixo", null, new Date(agora.getTime() + DIA).toISOString()],
    agora,
  );
  assert.deepEqual(r, { atual: 2, anterior: 2 });
});

// Ordem de8761b0, item 3 (resto): Visualizações e Mensagens também com período, contexto e próxima ação quando zero.
import { kpiVisualizacoes, kpiMensagens } from "./kpi-interessados.ts";

test("visualizações zero: nunca só '0' — período e próxima ação", () => {
  const k = kpiVisualizacoes({ atual: 0, anterior: 0 });
  assert.equal(k.rotulo, "Visualizações · últimos 30 dias");
  assert.equal(k.valor, "0");
  assert.match(k.dica, /Compartilhe seu anúncio/);
  assert.equal(k.href, "/dashboard/imoveis");
});

test("visualizações: comparação com os 30 dias anteriores e milhar em pt-BR", () => {
  assert.match(kpiVisualizacoes({ atual: 1200, anterior: 200 }).dica, /1\.000 a mais que nos 30 dias anteriores/);
  assert.equal(kpiVisualizacoes({ atual: 1200, anterior: 200 }).valor, "1.200");
  assert.match(kpiVisualizacoes({ atual: 3, anterior: 3 }).dica, /igual aos 30 dias anteriores/);
});

test("visualizações não lidas: '—' sem inventar zero nem ação", () => {
  const k = kpiVisualizacoes(null);
  assert.equal(k.valor, "—");
  assert.doesNotMatch(k.dica, /Compartilhe/);
});

test("mensagens zero: próxima ação em vez de só '0'", () => {
  const k = kpiMensagens(0);
  assert.equal(k.valor, "0");
  assert.match(k.dica, /responda rápido/i);
  assert.equal(k.href, "/dashboard/mensagens");
});

test("mensagens com conversas e sem leitura", () => {
  assert.equal(kpiMensagens(4).valor, "4");
  assert.match(kpiMensagens(4).dica, /conversas/);
  assert.equal(kpiMensagens(1).dica, "1 conversa com interessados");
  assert.equal(kpiMensagens(null).valor, "—");
});
