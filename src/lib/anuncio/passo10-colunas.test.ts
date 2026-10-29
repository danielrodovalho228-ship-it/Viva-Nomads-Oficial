/*
  E251 — Passo 10 em duas colunas: estado das seções do "Antes de publicar", motivo do botão travado em uma linha,
  os três preços da prévia e as regras de publicar que não mudam.
  Roda: node --test src/lib/anuncio/passo10-colunas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { motivoPublicarTravado, oQueFaltaParaPublicar, precosDaPrevia, secoesAntesDePublicar, type EntradaSecoes } from "./passo10-colunas.ts";
import { prontidaoAnuncio, type FatosAnuncio } from "./prontidao.ts";
import { CHAVES_CONFORTO } from "../../config/conforto-minimo.ts";
import { isEligible } from "../qualification.ts";
import { elegibilidadeDoCadastro } from "./requisitos-passo10.ts";
import { ROTULO_MENSAL, ROTULO_TOTAL_CONTRATO, ROTULO_TOTAL_MES } from "../precos.ts";
import type { Property } from "../types.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

const BASE: EntradaSecoes = {
  faltaOperacao: "",
  rotuloOperacao: "Sou o proprietário",
  identidade: "ok",
  documento: "aprovado",
  declaracoes: { iptuOk: true, habitavel: true, convencao: "yes" },
  emCondominio: true,
};
const estado = (e: Partial<EntradaSecoes>) => Object.fromEntries(secoesAntesDePublicar({ ...BASE, ...e }).map((s) => [s.id, s.estado]));

test("as quatro seções legais, na ordem do cartão, com ✓ quando feitas", () => {
  const s = secoesAntesDePublicar(BASE);
  assert.deepEqual(s.map((x) => x.id), ["operacao", "identidade", "documento", "declaracoes"]);
  assert.ok(s.every((x) => x.estado === "ok"));
});

test("documento: sem envio, em análise ou para corrigir → falta; o do início aparece como enviado", () => {
  assert.equal(estado({ documento: "nenhum" }).documento, "falta");
  assert.equal(estado({ documento: "revisao" }).documento, "falta");
  assert.equal(estado({ documento: "corrija" }).documento, "falta");
  const inicio = secoesAntesDePublicar({ ...BASE, documento: "revisao", linhaDocumentoInicio: "Documento enviado no início · em análise" });
  assert.equal(inicio.find((x) => x.id === "documento")?.resumo, "Documento enviado no início · em análise");
});

test("declarações: 'Não sei' fica ✓ (publica com pendência); 'Não' é falta; casa e chácara não pedem convenção", () => {
  assert.equal(estado({ declaracoes: { iptuOk: true, habitavel: true, convencao: "unknown" } }).declaracoes, "ok");
  assert.equal(estado({ declaracoes: { iptuOk: true, habitavel: true, convencao: "no" } }).declaracoes, "falta");
  assert.equal(estado({ declaracoes: { iptuOk: true, habitavel: true, convencao: "" } }).declaracoes, "falta");
  assert.equal(estado({ emCondominio: false, declaracoes: { iptuOk: true, habitavel: true, convencao: "" } }).declaracoes, "ok");
  assert.equal(estado({ declaracoes: { iptuOk: false, habitavel: true, convencao: "yes" } }).declaracoes, "falta");
});

test("quem opera: falta com o motivo; identidade nunca segura a publicação", () => {
  assert.equal(estado({ faltaOperacao: "Anexe a autorização" }).operacao, "falta");
  assert.equal(estado({ identidade: "pendente" }).identidade, "aviso");
  assert.equal(estado({ identidade: "em_breve" }).identidade, "aviso");
});

test("botão travado: o motivo cabe em UMA linha (o primeiro que falta e quantos mais)", () => {
  assert.equal(motivoPublicarTravado([]), null);
  assert.equal(motivoPublicarTravado(["documento do imóvel"]), "Falta: documento do imóvel");
  assert.equal(motivoPublicarTravado(["documento do imóvel", "declarações do imóvel", "aceite do termo da IA"]), "Falta: documento do imóvel e mais 2");
  for (const m of [motivoPublicarTravado(["padrão mínimo de conforto", "documento do imóvel"])!]) assert.doesNotMatch(m, /\n/);
});

const FATOS: FatosAnuncio = {
  enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 8, titulo: "Studio no Centro", preco: 3200, garantiaOk: true,
  sublocacaoOk: true, privacidadeOk: true, documento: "approved", descricao: "x".repeat(80), selo: false, video: false, confortoFaltam: 0,
};

test("as regras de publicar não mudam: sem os 12 itens trava; convenção 'Não' trava; 'Não sei' publica", () => {
  // Sem os 12 itens do essencial: a prontidão não publica e o motivo é o padrão mínimo.
  const semConforto = prontidaoAnuncio({ ...FATOS, confortoFaltam: CHAVES_CONFORTO.length });
  assert.equal(semConforto.podePublicar, false);
  assert.deepEqual(oQueFaltaParaPublicar({ completude: semConforto.obrigatorios, declaracoesOk: true, aceitouIa: true }), ["padrão mínimo de conforto"]);
  // Convenção: "Não" bloqueia (isEligible), "Não sei" publica.
  const eleg = (convencao: "no" | "unknown") =>
    isEligible(elegibilidadeDoCadastro({ mobiliado: true, minimoDias: 30, operacaoDeclarada: true, documentoEnviado: true, emCondominio: true, declaracoes: { iptuOk: true, habitavel: true, convencao } }));
  assert.equal(eleg("no"), false);
  assert.equal(eleg("unknown"), true);
  assert.deepEqual(oQueFaltaParaPublicar({ completude: prontidaoAnuncio(FATOS).obrigatorios, declaracoesOk: eleg("no"), aceitouIa: true }), ["declarações do imóvel"]);
  assert.deepEqual(oQueFaltaParaPublicar({ completude: prontidaoAnuncio(FATOS).obrigatorios, declaracoesOk: eleg("unknown"), aceitouIa: true }), []);
});

test("prévia: os três preços com os nomes fixos (Mensal · Total por mês (com contas) · Total do contrato)", () => {
  const imovel = { monthlyPrice: 3200, condoFee: 400, utilitiesMode: "fixed", utilitiesEstimate: 150, minPeriodDays: 60 } as unknown as Property;
  const linhas = precosDaPrevia(imovel);
  assert.deepEqual(linhas.map((l) => l.rotulo), [ROTULO_MENSAL, ROTULO_TOTAL_MES, ROTULO_TOTAL_CONTRATO]);
  assert.equal(linhas[0].valor, 3200);
  assert.ok((linhas[1].valor ?? 0) >= 3200);
  assert.equal(linhas[2].valor, (linhas[1].valor ?? 0) * 2);
  assert.match(linhas[2].conta ?? "", /^2 × R\$/);
});

test("tela: duas colunas (lista + prévia fixa), acordeão no lugar, um Publicar com o motivo em uma linha, prévia recolhida no celular", () => {
  const revisar = ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx");
  assert.match(revisar, /data-testid="passo10-coluna-lista"/);
  assert.match(revisar, /lg:sticky/);
  assert.match(revisar, /data-testid="publicar-motivo"/);
  assert.match(revisar, /Ver como fica o anúncio/);
  assert.match(revisar, /precosDaPrevia\(/);
  const antes = ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-onde-fica.tsx");
  assert.match(antes, /aria-expanded=\{aberta\}/);
  assert.match(antes, /secoesAntesDePublicar\(/);
  // Vocabulário: sem "aluguel", "temporada" ou "comissão" nos textos do Passo 10.
  for (const t of [revisar, ler("src/lib/anuncio/passo10-colunas.ts")]) {
    const textos = [...t.matchAll(/"([^"]{3,})"/g)].map((m) => m[1]).join(" | ");
    assert.doesNotMatch(textos, /aluguel|temporada|comiss/i);
  }
});
