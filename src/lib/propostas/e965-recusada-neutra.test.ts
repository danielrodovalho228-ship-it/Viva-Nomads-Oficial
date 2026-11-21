/*
  E965 — o morador NUNCA vê "recusada" (correção do coordenador, 15/11/2026): o texto neutro "Não seguiu adiante" já existia
  nas candidaturas, mas a proposta mostrava "Recusada" ao morador (etiqueta da lista e do detalhe, faixa "Recusada por…",
  cartão da conversa / sino e o e-mail quando o proprietário recusa). Correção: texto neutro em todas as superfícies do
  morador; o proprietário segue vendo "Recusada" na lista dele.
  Roda: node --test src/lib/propostas/e965-recusada-neutra.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rotuloStatusProposta, TEXTO_NAO_SEGUIU_ADIANTE, textoDaRecusaNaConversa } from "./regras.ts";
import { ROTULOS_CANDIDATURA } from "../candidaturas/status.ts";
import { aberturaProposta } from "../notifications/dados-negociacao.ts";
import { propostaRecusada } from "../notifications/emails-e205b.ts";

const proibida = /recus/i;

test("E965 — o texto neutro é o MESMO das candidaturas", () => {
  assert.equal(TEXTO_NAO_SEGUIU_ADIANTE, ROTULOS_CANDIDATURA.nao_seguiu.label);
});

test("E965 — etiqueta da proposta recusada: morador vê 'Não seguiu adiante', em tom neutro; proprietário segue com 'Recusada'", () => {
  assert.deepEqual(rotuloStatusProposta("recusada", "tenant"), { rotulo: "Não seguiu adiante", tom: "neutro" });
  assert.equal(rotuloStatusProposta("recusada", "owner").rotulo, "Recusada");
  assert.equal(rotuloStatusProposta("aceita", "tenant").rotulo, "Aceita → Em fechamento");
});

test("E965 — o cartão da conversa (que o morador lê) é neutro, com o motivo", () => {
  const t = textoDaRecusaNaConversa("PR-0001", "Datas", "Preciso só em dezembro");
  assert.doesNotMatch(t, proibida);
  assert.match(t, /PR-0001 não seguiu adiante\. Motivo: Datas\. Preciso só em dezembro/);
});

test("E965 — e-mail ao morador quando o proprietário recusa: assunto e corpo sem 'recus'", () => {
  const e = propostaRecusada({ quemRecusou: "owner", nomeDeQuemRecusou: "Carlos Lima", motivo: "Datas", propostaId: "p1", cidade: "Uberlândia" });
  assert.doesNotMatch(e.assunto, proibida);
  assert.doesNotMatch(e.abertura("Ana"), proibida);
  assert.match(e.abertura("Ana"), /não seguiu adiante/);
});

test("E965 — e-mail ao proprietário quando o morador recusa continua dizendo quem recusou (superfície do dono)", () => {
  const e = propostaRecusada({ quemRecusou: "tenant", nomeDeQuemRecusou: "Ana Souza", motivo: "Datas", propostaId: "p1" });
  assert.match(e.assunto, /Ana recusou a proposta/);
});

test("E965 — abertura do e-mail de negociação (vai às duas partes): neutra", () => {
  assert.doesNotMatch(aberturaProposta("recusada", { nome: "Ana", imovel: { titulo: "Apto Centro" } as never, motivo: "Datas" }), proibida);
});

test("E965 — telas do morador usam a etiqueta por papel e a faixa neutra", () => {
  const chip = readFileSync("src/components/propostas/status-chip.tsx", "utf8");
  assert.match(chip, /rotuloStatusProposta\(status, papel\)/);
  const lista = readFileSync("src/app/(dashboard)/dashboard/propostas/page.tsx", "utf8");
  assert.match(lista, /<StatusChip status=\{p\.status\} papel=\{p\.papel\} \/>/);
  const det = readFileSync("src/app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx", "utf8");
  assert.match(det, /<StatusChip status=\{p\.status\} papel=\{p\.papel\} \/>/);
  assert.match(det, /p\.papel === "tenant" \? `\$\{TEXTO_NAO_SEGUIU_ADIANTE\}\. Motivo:/);
  const acoes = readFileSync("src/lib/data/propostas-actions.ts", "utf8");
  assert.match(acoes, /textoDaRecusaNaConversa\(p\.numero, motivo, texto\)/);
});
