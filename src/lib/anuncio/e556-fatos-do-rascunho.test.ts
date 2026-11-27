/*
  E556 (família E497/E498) — completude lista × editor. O rascunho 4a693a63 aparecia em Meus imóveis a 75% com
  "Velocidade da internet (falta)" e "Declaração de privacidade (falta)", enquanto o editor mostrava 90% com 300 Mbps e
  a privacidade salvas: as colunas internet_mbps / sem_cameras_interior só são gravadas ao publicar, e a lista lia só
  elas. Agora, no rascunho, a lista lê os dois itens do draft_data com a MESMA regra do editor.
  Roda: node --test src/lib/anuncio/e556-fatos-do-rascunho.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fatosDoRascunho } from "./fatos-do-rascunho.ts";
import { prontidaoAnuncio, type FatosAnuncio } from "./prontidao.ts";

const base = (): FatosAnuncio => ({
  enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 8, titulo: "Casa mobiliada 2 quartos no Centro", preco: 3000,
  garantiaOk: true, sublocacaoOk: true, privacidadeOk: false, operacao: "owner", documento: "pending",
  descricao: "x".repeat(200), selo: false, video: false, internetOk: false,
});

test("rascunho com 300 Mbps e privacidade no draft_data: os dois itens contam (como no editor)", () => {
  const f = fatosDoRascunho({ internetMbps: "300", privacidade: { semCamerasInterior: true } }, base());
  assert.equal(f.internetOk, true);
  assert.equal(f.privacidadeOk, true);
  const p = prontidaoAnuncio(f);
  assert.ok(!p.faltam.some((x) => /internet|privacidade/i.test(x)), p.faltam.join(" | "));
});

test("draft_data sem a resposta: vale o que o editor mostra (falta), nunca inventa 'ok'", () => {
  const f = fatosDoRascunho({ internetMbps: "", privacidade: { semCamerasInterior: false } }, { ...base(), internetOk: true, privacidadeOk: true });
  assert.equal(f.internetOk, false);
  assert.equal(f.privacidadeOk, false);
});

test("draft_data sem as chaves: fica o que veio do banco (rascunho antigo)", () => {
  const f = fatosDoRascunho({ title: "x" }, { ...base(), internetOk: true, privacidadeOk: true });
  assert.equal(f.internetOk, true);
  assert.equal(f.privacidadeOk, true);
});

test("velocidade inválida não conta (mesmo mbpsValido do editor)", () => {
  assert.equal(fatosDoRascunho({ internetMbps: "abc" }, base()).internetOk, false);
  assert.equal(fatosDoRascunho({ internetMbps: 0 }, base()).internetOk, false);
});

test("Meus imóveis e Início: a leitura do draft_data aplica fatosDoRascunho (o portão do Publicar não muda)", () => {
  const s = readFileSync("src/lib/anuncio/prontidao-servidor.ts", "utf8");
  assert.match(s, /mapa\.set\(p\.id, fatosDoRascunho\(draftData, f\)\);/);
  assert.ok(s.indexOf("fatosDoRascunho(draftData, f)") > s.indexOf("if (opcoes.qualificacaoDoRascunho)"), "só com a opção das telas de progresso");
});
