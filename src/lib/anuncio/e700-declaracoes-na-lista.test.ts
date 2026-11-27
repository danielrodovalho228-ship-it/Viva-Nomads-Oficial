/*
  E700: com as declarações feitas (IPTU, água/luz/gás, convenção) o item "Declarações do imóvel (IPTU, água, luz e gás)" da
  lista "Falta para publicar" fica ok NA HORA, no Passo 10 e no cartão de /dashboard/imoveis. Antes ele só ficava ok com a
  elegibilidade COMPLETA — que inclui o documento do imóvel e a operação (que já têm item próprio na lista) — então
  continuava "pendente" com as declarações prontas e a pessoa não sabia o que faltava de verdade.
  Roda: node --test src/lib/anuncio/e700-declaracoes-na-lista.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { declaracoesDoImovelOk, declaracoesDoRascunhoOk, elegibilidadeDoCadastro } from "./requisitos-passo10.ts";
import { isEligible } from "../qualification.ts";

const base = { mobiliado: true, minimoDias: 30, operacaoDeclarada: true, documentoEnviado: false, emCondominio: false };
const feitas = { iptuOk: true, habitavel: true, convencao: "yes" as const };

test("declarações feitas e documento ainda não enviado: o item de declarações está ok (o documento tem item próprio)", () => {
  const e = elegibilidadeDoCadastro({ ...base, declaracoes: feitas });
  assert.equal(isEligible(e), false, "a elegibilidade completa segue travando a publicação");
  assert.equal(declaracoesDoImovelOk(e), true);
});

test("declaração faltando continua pendente; convenção 'não' e sem resposta também", () => {
  assert.equal(declaracoesDoImovelOk(elegibilidadeDoCadastro({ ...base, declaracoes: { ...feitas, iptuOk: false } })), false);
  assert.equal(declaracoesDoImovelOk(elegibilidadeDoCadastro({ ...base, declaracoes: { ...feitas, habitavel: false } })), false);
  assert.equal(declaracoesDoImovelOk(elegibilidadeDoCadastro({ ...base, emCondominio: true, declaracoes: { ...feitas, convencao: "no" } })), false);
  assert.equal(declaracoesDoImovelOk(elegibilidadeDoCadastro({ ...base, emCondominio: true, declaracoes: { ...feitas, convencao: "" } })), false);
  assert.equal(declaracoesDoImovelOk(elegibilidadeDoCadastro({ ...base, emCondominio: true, declaracoes: { ...feitas, convencao: "unknown" } })), true, "'não sei' publica com pendência");
});

test("imóvel não mobiliado ou com mínimo abaixo de 30 dias segue pendente neste item (não têm item próprio)", () => {
  assert.equal(declaracoesDoImovelOk(elegibilidadeDoCadastro({ ...base, mobiliado: false, declaracoes: feitas })), false);
  assert.equal(declaracoesDoImovelOk(elegibilidadeDoCadastro({ ...base, minimoDias: 15, declaracoes: feitas })), false);
});

test("o rascunho gravado conta igual (a lista de imóveis lê o draft_data)", () => {
  const d = { propertyType: "casa", furnished: true, declaracoesPasso10: { iptuOk: true, habitavel: true } };
  assert.equal(declaracoesDoRascunhoOk(d, { documento: "none", sublocacaoOk: true }), true);
  assert.equal(declaracoesDoRascunhoOk(null, { documento: "none", sublocacaoOk: true }), false);
});

test("o editor e a lista de imóveis alimentam a prontidão com o item de declarações (não com a elegibilidade completa)", () => {
  const page = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");
  assert.match(page, /qualificacaoOk: editingId \? undefined : declaracoesDoImovelOk\(elegibilidade\),/);
  const serv = readFileSync(new URL("./prontidao-servidor.ts", import.meta.url), "utf8");
  assert.match(serv, /f\.qualificacaoOk = declaracoesDoRascunhoOk\(draftData, f\);/);
});
