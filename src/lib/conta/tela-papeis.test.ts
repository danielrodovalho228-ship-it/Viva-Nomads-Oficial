/* A3 — Conta › Papéis e intenção (perfil-03). Roda: node --test src/lib/conta/tela-papeis.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RODAPE_PAPEIS, SUBTITULO_PAPEIS, alternarIntencao, linhaQueroMorar, resumoQueroMorar, textoQueroAnunciar } from "./tela-papeis.ts";

test("textos do desenho no vocabulário da casa (sem viajantes nem curto prazo)", () => {
  assert.equal(linhaQueroMorar("Uberlândia"), "Procurando imóvel de 1 a 6 meses em Uberlândia");
  assert.equal(linhaQueroMorar("  "), "Procurando imóvel de 1 a 6 meses");
  assert.equal(resumoQueroMorar("Uberlândia, MG"), "Uberlândia, MG · 1–6 meses · Mobiliado");
  assert.equal(resumoQueroMorar(null), "1–6 meses · Mobiliado");
  assert.equal(textoQueroAnunciar("Uberlândia"), "Publique seu imóvel para profissionais que buscam estadias de 1 a 6 meses em Uberlândia.");
  for (const t of [SUBTITULO_PAPEIS, RODAPE_PAPEIS, textoQueroAnunciar("X"), linhaQueroMorar("X")])
    assert.doesNotMatch(t, /viajante|curto prazo|médio prazo|temporada|h[oó]spede|reserva/i, t);
});

test("ligar/desligar uma intenção mantém as outras, na ordem oficial", () => {
  assert.deepEqual(alternarIntencao(["anunciar"], "morar", true), ["morar", "anunciar"]);
  assert.deepEqual(alternarIntencao(["morar", "anunciar"], "morar", false), ["anunciar"]);
  assert.deepEqual(alternarIntencao(["morar"], "morar", true), ["morar"]);
  assert.deepEqual(alternarIntencao([], "servicos", false), []);
});

test("a tela grava pela mesma ação da intenção e mantém o papel em uso embaixo", () => {
  const t = readFileSync(new URL("../../components/account/tela-papeis.tsx", import.meta.url), "utf8");
  assert.match(t, /salvarMinhaIntencao\(nova, null\)/);
  assert.match(t, /<SeusPapeis dentroDoBloco \/>/);
  assert.match(t, /href="\/dashboard\/imoveis\/novo"/);
  for (const id of ["papel-cartao-morar", "papel-morar-toggle", "papel-cartao-anunciar", "papel-comecar-anuncio", "papeis-preferencias", "papeis-ajuda"]) assert.match(t, new RegExp(id), id);
});
