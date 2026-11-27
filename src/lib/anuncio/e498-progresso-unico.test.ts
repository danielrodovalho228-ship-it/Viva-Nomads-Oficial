/*
  E498 (QA de cliques do proprietário, 02/11) — o progresso do MESMO rascunho divergia entre telas: o cartão do Início
  dizia "25% pronto", o assistente mostrava 30 no Passo 3, 40 no Passo 4 e 70 no Passo 7 (a barra contava o PASSO, não o
  que está pronto), e a lista do Início vinha numa ordem diferente da dos passos.
  Correção: fonte única de progresso — o pct de prontidaoAnuncio — no cartão do Início, na lista (checklist) e em todos
  os passos do assistente; a lista segue a ordem dos passos; e a qualificação do rascunho (declarações do Passo 10) entra
  no cálculo do servidor também, para o Início e Meus imóveis contarem os mesmos itens que o assistente.
  Roda: node --test src/lib/anuncio/e498-progresso-unico.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checklistAnuncio, prontidaoAnuncio, type FatosAnuncio } from "./prontidao.ts";
import { qualificacaoDoRascunho } from "./requisitos-passo10.ts";

const ler = (p: string) => readFileSync(p, "utf8");

const fatos = (o: Partial<FatosAnuncio> = {}): FatosAnuncio => ({
  enderecoOk: true,
  detalhesOk: false,
  periodoOk: true,
  fotos: 0,
  titulo: "",
  preco: 0,
  garantiaOk: false,
  sublocacaoOk: true,
  privacidadeOk: true,
  documento: "none",
  descricao: "",
  selo: false,
  video: false,
  ...o,
});

test("a lista do Início segue a ordem dos passos do assistente", () => {
  const c = checklistAnuncio(prontidaoAnuncio(fatos({ qualificacaoOk: false, internetOk: false, tipoEntradaOk: false })), "abc");
  const etapas = c.itens.map((i) => Number(new URL(i.href, "http://x").searchParams.get("etapa")));
  assert.deepEqual(etapas, [...etapas].sort((a, b) => a - b));
  // O primeiro que falta é o do passo mais cedo (Fotos, passo 2), não o de um passo à frente.
  assert.equal(c.proximo?.key, "fotos");
});

test("qualificação do rascunho: lida das declarações gravadas no draft_data, com a mesma regra do assistente", () => {
  const base = { documento: "pending" as const, sublocacaoOk: true };
  assert.equal(qualificacaoDoRascunho(null, base), false);
  assert.equal(qualificacaoDoRascunho({ propertyType: "casa", furnished: true, declaracoesPasso10: { iptuOk: true, habitavel: true } }, base), true);
  // Apartamento está em condomínio: sem a resposta da convenção não qualifica; "Não" barra.
  assert.equal(qualificacaoDoRascunho({ propertyType: "apartamento", declaracoesPasso10: { iptuOk: true, habitavel: true } }, base), false);
  assert.equal(qualificacaoDoRascunho({ propertyType: "apartamento", declaracoesPasso10: { iptuOk: true, habitavel: true, convencao: "no" } }, base), false);
  assert.equal(qualificacaoDoRascunho({ propertyType: "apartamento", declaracoesPasso10: { iptuOk: true, habitavel: true, convencao: "unknown" } }, base), true);
  // Sem documento enviado, ou com a operação sem autorização, não qualifica.
  assert.equal(qualificacaoDoRascunho({ propertyType: "casa", declaracoesPasso10: { iptuOk: true, habitavel: true } }, { documento: "none", sublocacaoOk: true }), false);
  assert.equal(qualificacaoDoRascunho({ propertyType: "casa", declaracoesPasso10: { iptuOk: true, habitavel: true } }, { documento: "pending", sublocacaoOk: false }), false);
  // Não mobiliado não qualifica.
  assert.equal(qualificacaoDoRascunho({ propertyType: "casa", furnished: false, declaracoesPasso10: { iptuOk: true, habitavel: true } }, base), false);
});

test("o assistente mostra na barra (todos os passos) o MESMO pct da prontidão, não a posição do passo", () => {
  const p = ler("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  const rodape = p.slice(p.indexOf("<RodapeAssistente"), p.indexOf("/>", p.indexOf("primario={")) + 2);
  assert.match(rodape, /pct=\{prontidao\.pct\}/);
  assert.match(rodape, /detalhe=\{textoPronto\(prontidao\)\}/);
});

test("Início e Meus imóveis contam a qualificação do rascunho (mesmos itens do assistente)", () => {
  const a = ler("src/lib/data/actions.ts");
  const ultimo = a.slice(a.indexOf("export async function getLatestDraft"), a.indexOf("// ── 64-B"));
  assert.match(ultimo, /fatosDosImoveis\(supabase, user\.id, \[data\.id as string\], \{ qualificacaoDoRascunho: true \}\)/);
  const lista = ler("src/app/(dashboard)/dashboard/imoveis/page.tsx");
  assert.match(lista, /prontidaoDosImoveis\(supabase, user\.id, properties\.map\(\(p\) => p\.id\), \{ qualificacaoDoRascunho: true \}\)/);
});

test("texto do progresso é um só: \"N% pronto\" (100% = pronto para publicar)", async () => {
  const { textoPronto } = await import("./prontidao.ts");
  assert.equal(textoPronto(prontidaoAnuncio(fatos())), `${prontidaoAnuncio(fatos()).pct}% pronto`);
});
