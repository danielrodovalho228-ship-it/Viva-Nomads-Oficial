/* Prompt 54 — painel de desempenho do anúncio. Roda: node --test src/lib/anuncio/desempenho.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FORMULAS,
  acoesDaNota,
  SEM_ESTIMATIVA,
  TEXTO_SEM_COMPARACAO,
  contar,
  conversao,
  janelas,
  linhaDoTempo,
  medianaDoGrupo,
  metricas,
  parecidos,
  taxaResposta,
  textoVariacao,
  type Evento,
} from "./desempenho.ts";

const agora = new Date("2026-10-23T12:00:00Z");
const diasAtras = (n: number) => new Date(agora.getTime() - n * 86_400_000).toISOString();
const DONO = "dono";
const fora = { donoId: DONO, contasTeste: new Set(["qa"]) };

const massa: Evento[] = [
  // Últimos 30 dias: 6 visualizações reais (4 anônimas + 2 de visitantes), 1 do dono e 1 de conta de teste (fora).
  ...[1, 2, 3, 4].map((d) => ({ tipo: "ver_anuncio", criado_em: diasAtras(d), usuario_id: null })),
  { tipo: "ver_anuncio", criado_em: diasAtras(5), usuario_id: "v1" },
  { tipo: "ver_anuncio", criado_em: diasAtras(6), usuario_id: "v2" },
  { tipo: "ver_anuncio", criado_em: diasAtras(7), usuario_id: DONO },
  { tipo: "ver_anuncio", criado_em: diasAtras(8), usuario_id: "qa" },
  { tipo: "favoritar", criado_em: diasAtras(5), usuario_id: "v1" },
  { tipo: "enviar_candidatura", criado_em: diasAtras(6), usuario_id: "v2" },
  { tipo: "enviar_candidatura", criado_em: diasAtras(9), usuario_id: "qa" },
  // 30 dias anteriores: 2 visualizações, nenhuma candidatura.
  { tipo: "ver_anuncio", criado_em: diasAtras(40), usuario_id: null },
  { tipo: "ver_anuncio", criado_em: diasAtras(50), usuario_id: "v3" },
  // Fora das duas janelas.
  { tipo: "ver_anuncio", criado_em: diasAtras(70), usuario_id: null },
];

test("fórmulas com massa de eventos: o dono e as contas de teste não contam", () => {
  const j = janelas(agora);
  const atual = contar(massa, j.atual, fora);
  const anterior = contar(massa, j.anterior, fora);
  assert.deepEqual(atual, { visualizacoes: 6, favoritos: 1, candidaturas: 1 });
  assert.deepEqual(anterior, { visualizacoes: 2, favoritos: 0, candidaturas: 0 });
  assert.equal(conversao(atual), 16.7, "1 candidatura ÷ 6 visualizações");
  assert.equal(conversao({ visualizacoes: 0, favoritos: 0, candidaturas: 0 }), null, "sem visualização não divide");
  assert.equal(taxaResposta(10, 9), 90);
  assert.equal(taxaResposta(2, 2), null, "poucas conversas: sem taxa (critério do selo)");
});

test("o grupo de comparação: mesma cidade e quartos, mesmo bairro ou até 2 km; < 5 não compara", () => {
  const alvo = { id: "a", cidade: "Uberlândia", bairro: "Santa Mônica", quartos: 2, lat: -18.918, lng: -48.258 };
  const outros = [
    { id: "a", cidade: "Uberlândia", bairro: "Santa Mônica", quartos: 2, lat: -18.918, lng: -48.258 },
    { id: "b", cidade: "Uberlandia", bairro: "Santa Monica", quartos: 2, lat: null, lng: null },
    { id: "c", cidade: "Uberlândia", bairro: "Centro", quartos: 2, lat: -18.925, lng: -48.26 },
    { id: "d", cidade: "Uberlândia", bairro: "Centro", quartos: 2, lat: -18.85, lng: -48.2 },
    { id: "e", cidade: "Uberlândia", bairro: "Santa Mônica", quartos: 3, lat: -18.918, lng: -48.258 },
    { id: "f", cidade: "Araguari", bairro: "Santa Mônica", quartos: 2, lat: -18.918, lng: -48.258 },
  ];
  assert.deepEqual(parecidos(alvo, outros).map((o) => o.id), ["b", "c"]);
  assert.equal(medianaDoGrupo([1, 2, 3, 4]), null, "4 imóveis: não compara");
  assert.equal(medianaDoGrupo([5, 1, 3, 9, 7]), 5);
  assert.equal(medianaDoGrupo([1, 2, 3, 4, 5, 6]), 3.5);
  assert.match(TEXTO_SEM_COMPARACAO, /ainda não há imóveis parecidos suficientes para comparar/i);
});

test("todo número tem fórmula escrita; variação só descreve o que aconteceu", () => {
  const ms = metricas({
    atual: { visualizacoes: 6, favoritos: 1, candidaturas: 1 },
    anterior: { visualizacoes: 2, favoritos: 0, candidaturas: 0 },
    resposta: 90,
    medianas: { visualizacoes: 10 },
  });
  assert.equal(ms.length, 5);
  for (const m of ms) assert.ok(m.formula && m.formula === FORMULAS[m.chave], m.chave);
  assert.equal(ms[0].mediana, 10);
  assert.equal(ms[1].mediana, null);
  assert.equal(textoVariacao(6, 2, ""), "↑ 4 em relação aos 30 dias anteriores.");
  assert.equal(textoVariacao(16.7, 0, "%"), "↑ 16,7 p.p. em relação aos 30 dias anteriores.");
  assert.equal(textoVariacao(2, 2, ""), "Igual aos 30 dias anteriores.");
  assert.equal(textoVariacao(null, 2, ""), null);
});

test("linha do tempo: visualizações por semana e o que mudou na semana", () => {
  const marcas = [
    { em: diasAtras(3), texto: "Anúncio publicado" },
    { em: diasAtras(10), texto: "Internet medida" },
  ];
  const linha = linhaDoTempo(massa, marcas, agora, fora, 4);
  assert.equal(linha.length, 4);
  assert.equal(linha[3].visualizacoes, 6, "semana atual: 6 (sem dono e teste)");
  assert.deepEqual(linha[3].marcas, ["Anúncio publicado"]);
  assert.deepEqual(linha[2].marcas, ["Internet medida"]);
  assert.equal(linha[0].visualizacoes, 0);
});

test("ao lado do número, a ação: o que falta na nota, com os pontos da nota", () => {
  const a = acoesDaNota([
    { codigo: "comodos", texto: "3 cômodos", pontos: 6 },
    { codigo: "descricao", texto: "Descrição curta", pontos: 0 },
    { codigo: "identidade", texto: "Identidade confirmada", pontos: 12 },
    { codigo: "avaliacoes", texto: "Sem avaliações", pontos: 3 },
  ]);
  assert.deepEqual(a, [
    { codigo: "comodos", texto: "Fotografe mais cômodos diferentes", pontos: 6 },
    { codigo: "descricao", texto: "Complete a descrição (60+ palavras)", pontos: 6 },
  ]);
});

test("nenhum texto de ganho estimado no painel (lib, servidor e tela)", () => {
  const arquivos = [
    "./desempenho.ts",
    "../data/desempenho-anuncio.ts",
    "../../app/(dashboard)/dashboard/imoveis/[id]/desempenho/page.tsx",
  ].map((p) =>
    readFileSync(new URL(p, import.meta.url), "utf8")
      .replace(/export const SEM_ESTIMATIVA[^\n]*\n/, "")
      // Só o que a pessoa lê: comentários (que dizem "sem ganho estimado") ficam fora da varredura.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, ""),
  );
  for (const t of arquivos) assert.doesNotMatch(t, SEM_ESTIMATIVA);
  for (const f of Object.values(FORMULAS)) assert.doesNotMatch(f, SEM_ESTIMATIVA);
  // O nível entra como fato (o que falta para o próximo), nunca com número de ganho.
  const tela = arquivos[2];
  assert.match(tela, /data-testid="desempenho-formula"/);
  assert.match(tela, /TEXTO_SEM_COMPARACAO/);
});
