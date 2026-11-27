/*
  E619: o "Faltam 7 itens" da Revisão não fechava à primeira leitura — a lista mostrava 3 linhas (Fotos; Comodidades com 3
  subitens; Regras) e as seções Documento e Declarações; o 7 só saía contando subitens e seções. E o aceite do termo da
  IA, um oitavo bloqueador, só aparecia no título. Agora uma linha logo abaixo do título faz a conta à vista.
  Roda: node --test src/lib/anuncio/e619-conta-da-revisao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contaDaConferencia } from "./passo10-colunas.ts";
import { conferenciaAssistente, faltamNaConferencia } from "./assistente-dez-etapas.ts";
import { prontidaoAnuncio, type FatosAnuncio } from "./prontidao.ts";

const fatos: FatosAnuncio = {
  enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 3, titulo: "Apto", preco: 3000, garantiaOk: true,
  sublocacaoOk: true, privacidadeOk: false, operacao: "own", documento: "none", descricao: "x".repeat(80),
  qualificacaoOk: false, tipoEntradaOk: false, internetOk: false, confortoFaltam: 12, selo: false, video: false,
};

test("E619: o caso da reprova — 5 itens em 3 passos + 2 no Antes de publicar = 7, e o aceite à parte", () => {
  const c = conferenciaAssistente(prontidaoAnuncio(fatos));
  assert.equal(faltamNaConferencia(c), 7);
  const conta = contaDaConferencia({ itens: c.itens, pendentesNaRevisao: c.pendentesNaRevisao, aceitouIa: false });
  assert.equal(conta, "A conta: 5 itens em 3 passos da lista + 2 no “Antes de publicar” = 7. Também falta o aceite do termo da IA, no fim desta coluna.");
});

test("E619: só uma das partes, e nada faltando", () => {
  assert.equal(
    contaDaConferencia({ itens: [{ ok: false, faltam: ["8 fotos"] }], pendentesNaRevisao: [], aceitouIa: true }),
    "A conta: 1 item em 1 passo da lista.",
  );
  assert.equal(contaDaConferencia({ itens: [], pendentesNaRevisao: ["Documento"], aceitouIa: true }), "A conta: 1 no “Antes de publicar”.");
  assert.equal(contaDaConferencia({ itens: [], pendentesNaRevisao: [], aceitouIa: false }), null);
  assert.equal(contaDaConferencia({ itens: [], pendentesNaRevisao: [], aceitouIa: true }), null);
});

test("E619: a Revisão mostra a conta logo abaixo do título da lista", () => {
  const tela = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx", import.meta.url), "utf8");
  assert.match(tela, /data-testid="conferencia-conta"/);
  assert.match(tela, /contaDaConferencia\(/);
});
