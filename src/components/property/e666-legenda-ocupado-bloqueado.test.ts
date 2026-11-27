import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E666: a legenda do calendário do anúncio separa OCUPADO (já reservado) de BLOQUEADO pelo proprietário e responde "as datas estão livres?".
const src = readFileSync(new URL("./availability-calendar.tsx", import.meta.url), "utf8");
const legenda = src.slice(src.indexOf('data-testid="calendario-legenda"'), src.indexOf("Resumo da seleção"));
const dados = readFileSync(new URL("../../lib/data/blocks-actions.ts", import.meta.url), "utf8");

test("E666: a legenda tem dois itens, Ocupado e Bloqueado pelo proprietário, cada um com a cor do dia", () => {
  assert.match(src, /ROTULO_OCUPADO = "Ocupado \(já reservado\)"/);
  assert.match(src, /ROTULO_BLOQUEADO = "Bloqueado pelo proprietário"/);
  assert.match(legenda, /COR_DIA\.ocupado[\s\S]{0,120}ROTULO_OCUPADO/);
  assert.match(legenda, /COR_DIA\.bloqueado[\s\S]{0,120}ROTULO_BLOQUEADO/);
});

test("E666: ocupado e bloqueado diferem na forma (listrado), não só no tom", () => {
  const cores = src.match(/export const COR_DIA = \{([\s\S]+?)\} as const/)?.[1] ?? "";
  assert.match(cores, /bloqueado: "[^"]*repeating-linear-gradient/);
  assert.doesNotMatch(cores.match(/ocupado: "([^"]+)"/)?.[1] ?? "", /repeating/);
});

test("E666: a origem vem do servidor — contrato e agenda importada = ocupado; fechado à mão = bloqueado; sem migração", () => {
  const fn = dados.slice(dados.indexOf("export async function getDatasIndisponiveis"), dados.indexOf("export async function addBlock"));
  assert.match(fn, /b\.origem === "importado" \? \("ocupado" as const\) : \("bloqueado" as const\)/);
  assert.match(fn, /tipo: "ocupado" as const/);
});

test("E666: uma linha sob a legenda responde se as datas estão livres, sem prometer data nem prazo", () => {
  assert.match(legenda, /data-testid="calendario-resposta-livres"/);
  const nota = src.match(/NOTA_DATAS_LIVRES = "([^"]+)"/)?.[1] ?? "";
  assert.match(nota, /livres para pedir/);
  assert.match(nota, /pergunte ao proprietário/);
  assert.doesNotMatch(nota, /\d/);
});

test("E666: o rótulo de acessibilidade do dia diz a causa (ocupado × bloqueado)", () => {
  assert.match(src, /\(ocupado: já reservado\)/);
  assert.match(src, /\(bloqueado pelo proprietário\)/);
});
