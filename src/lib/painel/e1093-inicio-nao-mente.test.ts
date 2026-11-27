/*
  E1093 (ORDENS 446 e 565) — o painel do dono não perde secções em silêncio quando uma leitura falha.
  Provado no laboratório (falha injetada na confirmação da sessão): o Início passava a dizer "Anuncie seu primeiro
  imóvel" a quem tem imóveis, sem aviso, e o cartão "Avaliação do imóvel" sumia da grade de Serviços. Aqui:
   1. as leituras do Início confirmam a sessão por usuarioDaLeitura (repete a confirmação que falhou e, com `exigir`,
      a falha LANÇA: entra no aviso do topo, não vira lista vazia);
   2. o bloco principal do dono não afirma o que não leu ("Anuncie seu primeiro imóvel", "Tudo em dia");
   3. o cartão da avaliação não some por leitura falhada: a falha sobe e a tela avisa, com "Tentar de novo";
   4. com leitura falhada, o Início relê-se sozinho uma vez (na montagem da página, todas as leituras de uma carga
      partilham a mesma confirmação de sessão: só uma carga nova confirma de novo).
  Roda: node --test src/lib/painel/e1093-inicio-nao-mente.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { blocoPrincipalDono } from "./inicio-dono.ts";
import { ESPERA_RELEITURA_INICIO_MS, INTERVALO_RELEITURA_INICIO_MS, deveRelerOInicio } from "./sem-leitura.ts";
import type { Decisao } from "./decisoes.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const dec = (id: string): Decisao => ({ id, tipo: "proposta", texto: `Decisão ${id}`, href: `/d/${id}`, prazo: null, atrasada: false } as unknown as Decisao);
const base = { rascunho: null, decisoes: [] as Decisao[], fotoAnuncio: null };

test("2. anúncios NÃO lidos: o bloco não diz 'Anuncie seu primeiro imóvel' — diz que não leu e leva aos anúncios", () => {
  const b = blocoPrincipalDono({ ...base, temAnuncio: false, naoLido: { imoveis: true, decisoes: false } });
  assert.equal(b.tipo, "sem_leitura");
  assert.notEqual(b.titulo, "Anuncie seu primeiro imóvel");
  assert.equal(b.botao.href, "/dashboard/imoveis", "o botão leva aos anúncios do dono, não a criar um novo");
  assert.match(b.linha, /Não foi possível ler/);
  assert.deepEqual(b.passos, [], "sem o guia de quem nunca anunciou");
});

test("2. decisões NÃO lidas: o bloco não diz 'Tudo em dia'", () => {
  const b = blocoPrincipalDono({ ...base, temAnuncio: true, naoLido: { imoveis: false, decisoes: true } });
  assert.equal(b.tipo, "sem_leitura");
  assert.notEqual(b.titulo, "Tudo em dia");
  assert.match(b.linha, /Não foi possível ler/);
});

test("2. o que FOI lido continua a valer: uma decisão conhecida aparece, mesmo com os anúncios por ler", () => {
  const b = blocoPrincipalDono({ ...base, decisoes: [dec("a")], temAnuncio: false, naoLido: { imoveis: true, decisoes: false } });
  assert.deepEqual([b.tipo, b.botao.href], ["decisao", "/d/a"]);
});

test("2. tudo lido: nada muda (primeiro anúncio para quem não tem; tudo em dia para quem tem)", () => {
  assert.equal(blocoPrincipalDono({ ...base, temAnuncio: false }).tipo, "primeiro_anuncio");
  assert.equal(blocoPrincipalDono({ ...base, temAnuncio: true }).tipo, "em_dia");
  assert.equal(blocoPrincipalDono({ ...base, temAnuncio: false, naoLido: { imoveis: false, decisoes: false } }).tipo, "primeiro_anuncio");
});

test("1. o Início: o bloco recebe o que não foi lido, e as leituras da própria página exigem a sessão confirmada", () => {
  const inicio = semComentarios(ler("src/app/(dashboard)/dashboard/inicio-dados.tsx"));
  assert.match(inicio, /naoLido: \{ imoveis: semLeitura\.includes\("imoveis"\)/, "o bloco principal sabe o que não foi lido");
  assert.doesNotMatch(inicio, /supabase\.auth\.getUser\(\);\s*if \(!user\) return \{ atual: 0, anterior: 0 \}/, "interessados: a sessão por confirmar não vira 0");
  const interessados = inicio.slice(inicio.indexOf("async function interessadosDoDono("), inicio.indexOf("async function cidadeDoPerfil("));
  assert.match(interessados, /usuarioExigido\(supabase\)/);
  const pausada = inicio.slice(inicio.indexOf("async function contaPausadaEm("), inicio.indexOf("async function capaDoRascunho("));
  assert.match(pausada, /usuarioExigido\(supabase\)/);
});

test("1. as leituras do Início com `exigir` confirmam a sessão por usuarioDaLeitura (a falha lança, não vira vazio)", () => {
  const leitores: [string, string][] = [
    ["src/lib/data/properties.ts", "export async function listMyProperties("],
    ["src/lib/data/estadia.ts", "export async function estadiasDaHome("],
    ["src/lib/data/painel-decisoes.ts", "export async function dadosDasDecisoes("],
    ["src/lib/data/leads-actions.ts", "export async function listMinhasCandidaturas("],
    ["src/lib/data/messages.ts", "export async function listConversations("],
  ];
  for (const [arquivo, funcao] of leitores) {
    const s = semComentarios(ler(arquivo));
    const i = s.indexOf(funcao);
    assert.ok(i >= 0, `${arquivo}: ${funcao}`);
    const corpo = s.slice(i, i + 900);
    assert.match(corpo, /usuarioDaLeitura\(supabase, opcoes\)/, `${arquivo}: a sessão desta leitura`);
    assert.doesNotMatch(corpo, /supabase\.auth\.getUser\(\)/, `${arquivo}: sem a confirmação que virava "sem sessão"`);
  }
  for (const arquivo of ["src/lib/data/propostas-actions.ts", "src/lib/data/buscas-salvas-actions.ts"]) {
    const s = semComentarios(ler(arquivo));
    assert.match(s, /async function sessao\(opcoes: \{ exigir\?: boolean \} = \{\}\)/, arquivo);
    assert.match(s, /const s = await sessao\(opcoes\);/, `${arquivo}: a lista passa o exigir à sessão`);
  }
});

test("3. o cartão 'Avaliação do imóvel': leitura falhada não é 'sem cartão' — a falha sobe (a tela avisa)", () => {
  const srv = semComentarios(ler("src/lib/vistoria/servico-avaliacao.ts"));
  assert.doesNotMatch(srv, /catch \{\s*return null;\s*\}/, "nenhuma leitura falhada vira null em silêncio");
  assert.doesNotMatch(srv, /\bcatch\b/, "nenhuma leitura falhada é engolida");
  const porta = srv.slice(srv.indexOf("export async function portaDaAvaliacao("), srv.indexOf("async function papelEmUsoNoServidor("));
  assert.match(porta, /usuarioExigido\(supabase\)/);
  assert.doesNotMatch(porta, /if \(erro\w*( \|\| erro\w*)?\) return null;/, "erro de leitura não devolve null");
  // As duas leituras do papel também lançam quando a sessão não se confirma.
  assert.match(semComentarios(ler("src/lib/data/mode-actions.ts")), /usuarioExigido\(supabase\)/);
  assert.match(semComentarios(ler("src/lib/papel/papel-inicial-servidor.ts")), /usuarioExigido\(supabase\)/);
});

test("4. a releitura do Início: uma vez, e não outra nos 10 s seguintes (nunca um laço de recargas)", () => {
  const t0 = 1_800_000_000_000;
  assert.equal(deveRelerOInicio(null, t0), true, "nunca releu nesta aba");
  assert.equal(deveRelerOInicio(t0, t0 + 2_000), false, "acabou de reler: fica o aviso");
  assert.equal(deveRelerOInicio(t0, t0 + INTERVALO_RELEITURA_INICIO_MS - 1), false);
  assert.equal(deveRelerOInicio(t0, t0 + INTERVALO_RELEITURA_INICIO_MS), true, "passado o intervalo, pode de novo");
  assert.equal(deveRelerOInicio(Number.NaN, t0), true, "valor guardado ilegível");
  assert.equal(deveRelerOInicio(t0 + 60_000, t0), true, "valor guardado no futuro não trava a releitura");
  assert.ok(ESPERA_RELEITURA_INICIO_MS >= 500 && ESPERA_RELEITURA_INICIO_MS <= 5_000);
});

test("4. o Início monta a releitura só quando alguma leitura falhou; o componente usa a regra e o router.refresh", () => {
  const inicio = semComentarios(ler("src/app/(dashboard)/dashboard/inicio-dados.tsx"));
  assert.match(inicio, /\{semLeitura\.length > 0 && <RelerInicio \/>\}/);
  const c = semComentarios(ler("src/components/painel/reler-inicio.tsx"));
  assert.match(c, /^"use client";/);
  assert.match(c, /if \(!deveRelerOInicio\(ultima, agora\)\) return;/);
  assert.match(c, /router\.refresh\(\)/);
  assert.match(c, /window\.clearTimeout\(t\)/);
});
