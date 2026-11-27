/* Roda: node --test src/lib/imovel/e920-periodo-de-referencia.test.ts
   E920 (medido pelo Gerente em produção, 14/11) + E890 (Phoenix, RELATORIO-032): a página do imóvel abria com o total do período de
   referência do cartão e, ao assentar, mudava SOZINHA para outro período ("R$ 3.350 em 1 mês" → "R$ 18.850 em 6 meses"). As somas
   fechavam; o defeito era a troca sem ação de quem lê. Causa: depois de carregar, a página lia a duração da ÚLTIMA BUSCA guardada no
   aparelho (vn:ultima-busca, sem prazo de validade) e trocava os meses do total.
   Regra: a página abre E FICA no período de referência (a estadia mínima, como o cartão). O período do total só muda por ação
   explícita de quem lê: escolher as datas de entrada e de saída. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_PROPERTIES } from "../properties.ts";
import { mesesDoCartao } from "../cartao-preco.ts";
import { modeloDoCartao } from "../cartao-modelo.ts";
import { SELECAO_VAZIA, clicarDia, comEntrada, comEntradaDaBusca, comSaida, semDatas } from "./selecao-estadia.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const imovel = (id: string) => SAMPLE_PROPERTIES.find((p) => p.id === id)!;

test("E920: sem escolha de datas, os meses do total são os da estadia mínima — o período de referência do cartão", async () => {
  const { mesesDoTotalDaPagina } = await import("./selecao-estadia.ts");
  for (const p of SAMPLE_PROPERTIES) {
    const referencia = mesesDoCartao(undefined, p.minPeriodDays);
    assert.equal(mesesDoTotalDaPagina(SELECAO_VAZIA, p.minPeriodDays), referencia, `${p.id}: página = estadia mínima`);
    assert.equal(mesesDoTotalDaPagina(SELECAO_VAZIA, p.minPeriodDays), modeloDoCartao(p).totalEstadia.meses, `${p.id}: página = cartão`);
  }
  assert.equal(mesesDoTotalDaPagina(SELECAO_VAZIA, imovel("ube-001").minPeriodDays), 1);
  assert.equal(mesesDoTotalDaPagina(SELECAO_VAZIA, imovel("ube-003").minPeriodDays), 2, "ube-003 pede 60 dias");
  assert.equal(mesesDoTotalDaPagina(SELECAO_VAZIA, undefined), 1);
  assert.equal(mesesDoTotalDaPagina(SELECAO_VAZIA, null), 1);
});

test("E920: a função não tem por onde receber a duração da última busca (só a seleção e a estadia mínima)", async () => {
  const { mesesDoTotalDaPagina } = await import("./selecao-estadia.ts");
  assert.equal(mesesDoTotalDaPagina.length, 2);
  // A entrada que vem da última busca (E816) pré-preenche o campo, mas sozinha NÃO muda o período do total.
  const daBusca = comEntradaDaBusca(SELECAO_VAZIA, "2027-03-01");
  assert.equal(mesesDoTotalDaPagina(daBusca, 30), 1);
  assert.equal(mesesDoTotalDaPagina(daBusca, 60), 2);
});

test("E920: o período do total só muda quando quem lê escolhe as datas (entrada E saída)", async () => {
  const { mesesDoTotalDaPagina } = await import("./selecao-estadia.ts");
  // Só a entrada: ainda o período de referência.
  const soEntrada = comEntrada(SELECAO_VAZIA, "2027-03-01");
  assert.equal(mesesDoTotalDaPagina(soEntrada, 30), 1);
  // Entrada e saída pelos campos: 180 dias = 6 meses.
  const seis = comSaida(soEntrada, "2027-08-28");
  assert.equal(mesesDoTotalDaPagina(seis, 30), 6);
  // Pelo calendário (dois cliques): 60 dias = 2 meses.
  const dois = clicarDia(clicarDia(SELECAO_VAZIA, "2027-03-01"), "2027-04-30");
  assert.equal(mesesDoTotalDaPagina(dois, 30), 2);
  // Limpar as datas volta ao período de referência.
  assert.equal(mesesDoTotalDaPagina(semDatas(seis), 30), 1);
  assert.equal(mesesDoTotalDaPagina(semDatas(seis), 60), 2);
});

test("E920 (estático): a página do imóvel não troca o período do total com a duração guardada da última busca", () => {
  const pagina = ler("src/app/(public)/imoveis/[id]/property-detail.tsx");
  assert.match(pagina, /const meses = mesesDoTotalDaPagina\(selecao, property\.minPeriodDays\);/);
  assert.doesNotMatch(pagina, /mesesBusca|setMesesBusca/, "nenhum estado guarda os meses da última busca");
  // A leitura do aparelho segue só para a data de entrada sugerida (E816/E517), nunca para os meses.
  assert.match(pagina, /const \{ inicio \} = ultimaBuscaParaPedido\(/);
  assert.doesNotMatch(pagina, /const \{ inicio, meses \} = ultimaBuscaParaPedido\(/);
  // O cartão lateral e a barra do celular recebem os mesmos meses.
  assert.match(pagina, /<PriceCard property=\{property\} actions=\{actions\} meses=\{meses\}/);
  assert.match(pagina, /barraFixaImovel\(\{[^}]*\bmeses,/);
});
