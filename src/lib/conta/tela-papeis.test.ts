/* A3 — Conta › Papéis e intenção (perfil-03). Roda: node --test src/lib/conta/tela-papeis.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOTAO_PARCEIRO_ATIVO, BOTAO_QUERO_PARCEIRO, RODAPE_PAPEIS, SUBTITULO_PAPEIS, TEXTO_QUERO_PARCEIRO, alternarIntencao, linhaQueroMorar, resumoQueroMorar, textoQueroAnunciar } from "./tela-papeis.ts";

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
  assert.match(t, /data-testid=\{`papel-cartao-\$\{id\}`\}/);
  for (const id of ["papel-morar-toggle", "papel-comecar-anuncio", "papel-parceiro-botao", "papeis-preferencias", "papeis-ajuda"]) assert.match(t, new RegExp(id), id);
});

test("perfil-03-papeis-com-fotos: três cartões num padrão só, cada um com a foto do acervo do mesmo tamanho", async () => {
  const t = readFileSync(new URL("../../components/account/tela-papeis.tsx", import.meta.url), "utf8");
  const { PHOTOS } = await import("../media.ts");
  assert.deepEqual(Object.keys(PHOTOS.papeis), ["morar", "anunciar", "parceiro"]);
  for (const f of Object.values(PHOTOS.papeis)) assert.match(f, /^\/images\/.+\.webp$/, "foto do acervo da plataforma, não do usuário");
  assert.equal(new Set(Object.values(PHOTOS.papeis)).size, 3, "uma foto diferente por cartão");
  for (const id of ["morar", "anunciar", "parceiro"]) assert.match(t, new RegExp(`<CartaoPapel id="${id}" foto=\\{PHOTOS\\.papeis\\.${id}\\}`), id);
  // Um só componente de cartão: a foto tem a mesma medida nos três (o de parceiro não ganha layout próprio).
  assert.equal((t.match(/<Image /g) ?? []).length, 1);
  assert.match(t, /href="\/dashboard\/parceiro"/);
  assert.equal(TEXTO_QUERO_PARCEIRO, "Ofereça serviços para moradores e proprietários");
  assert.equal(BOTAO_QUERO_PARCEIRO, "Cadastrar meu serviço");
  for (const x of [TEXTO_QUERO_PARCEIRO, BOTAO_QUERO_PARCEIRO, BOTAO_PARCEIRO_ATIVO]) assert.doesNotMatch(x, /comiss|h[oó]spede|reserva/i);
});
