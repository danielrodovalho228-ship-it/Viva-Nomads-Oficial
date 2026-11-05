/*
  E598 (rascunho "[TESTE QA] 1379 Studio no Santa Mônica", proprietario2): a Revisão dizia "Faltam 4 itens antes de
  publicar" enquanto o cartão de Meus imóveis listava 6 itens em "Falta para publicar". Os dois leem a MESMA prontidão
  (E556: fatosDoRascunho), mas a Revisão contava as LINHAS da lista de conferência (um passo com dois itens faltando,
  como Preço sem preço e sem garantia, contava 1). Correção: o número sai dos itens que a lista mostra (os "Falta: …" de
  cada passo + as pendências do Passo 10), que são os mesmos itens do cartão.
  Roda: node --test src/lib/anuncio/e598-contagem-faltantes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prontidaoAnuncio, type FatosAnuncio } from "./prontidao.ts";
import { conferenciaAssistente, faltamNaConferencia } from "./assistente-dez-etapas.ts";
import { motivoPublicarTravado } from "./passo10-colunas.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

const COMPLETO: FatosAnuncio = {
  enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 8, titulo: "Studio no Santa Mônica", preco: 3200, garantiaOk: true,
  sublocacaoOk: true, privacidadeOk: true, documento: "approved", descricao: "x".repeat(80), selo: false, video: false, confortoFaltam: 0,
};

// Seis itens em quatro passos: Título e descrição (título + descrição), Preço (preço + garantia), Fotos, Disponibilidade.
const RASCUNHO: FatosAnuncio = { ...COMPLETO, titulo: "", descricao: "", preco: 0, garantiaOk: false, fotos: 0, periodoOk: false };

test("o número da Revisão é o número de itens do cartão (a mesma prontidão), não o de passos", () => {
  const p = prontidaoAnuncio(RASCUNHO);
  const doCartao = p.obrigatorios.filter((o) => !o.ok).length; // o "Falta para publicar" de Meus imóveis
  const c = conferenciaAssistente(p);
  const passos = c.itens.filter((i) => !i.ok).length;
  assert.ok(doCartao > passos, `o caso do defeito: ${doCartao} itens em ${passos} passos`);
  assert.equal(faltamNaConferencia(c), doCartao);
  assert.equal(motivoPublicarTravado({ faltamNaLista: faltamNaConferencia(c), aceitouIa: true }), `Faltam ${doCartao} itens antes de publicar`);
});

test("o número é a soma dos itens que a lista mostra (\"Falta: …\" de cada passo + pendências do Passo 10)", () => {
  const p = prontidaoAnuncio({ ...RASCUNHO, documento: "none" });
  const c = conferenciaAssistente(p);
  const naTela = c.itens.reduce((n, i) => n + (i.ok ? 0 : i.faltam.length), 0) + c.pendentesNaRevisao.length;
  assert.equal(faltamNaConferencia(c), naTela);
  assert.equal(faltamNaConferencia(c), p.obrigatorios.filter((o) => !o.ok).length);
  assert.equal(faltamNaConferencia(conferenciaAssistente(prontidaoAnuncio(COMPLETO))), 0);
});

test("tela: o data-faltam da lista conta os itens dela pela mesma função do motivo (as seções do Passo 10 ficam fora)", () => {
  const s = ler("app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx");
  assert.match(s, /data-faltam=\{faltamNaConferencia\(\{ itens: conf\.itens, pendentesNaRevisao: \[\] \}\)\}/);
});
