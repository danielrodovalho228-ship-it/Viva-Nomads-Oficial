/*
  E1125 (ORDEM-DUET-539, classe A) — dois resíduos do E1104, um por ramo:
   1. O MORADOR via o cartão "Avaliação do imóvel". A regra antiga olhava só a conta (tem imóvel, ou se cadastrou como
      proprietário) e não o papel em uso: a conta de dono a usar o painel como moradora ganhava o cartão. Regra: o cartão
      só existe no papel de PROPRIETÁRIO; em morador ou parceiro, nunca.
   2. Com VÁRIAS avaliações em curso, o cartão levava a uma delas (a do imóvel criado por último) sem dizer qual. Regra:
      uma em curso → direto a ela; mais de uma → a porta, que as lista da pedida mais recentemente para a mais antiga.
  Roda: node --test src/lib/vistoria/e1125-cartao-so-do-dono.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";
import {
  HREF_PORTA_AVALIACAO,
  hrefDaAvaliacaoNoImovel,
  hrefDoCartaoDaAvaliacao,
  linhaDoPedidoEmCurso,
  ordenarParaAPorta,
  papelEmUso,
  podeVerOCartao,
  textoVariasEmCurso,
  type ImovelNaPorta,
} from "./porta-da-avaliacao.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const imovel = (id: string, pedidoEm: string | null = null): ImovelNaPorta => ({ id, titulo: `Casa ${id}`, cidade: "Uberlândia", emCurso: pedidoEm !== null, pedidoEm });

test("E1125 (1): o papel em uso sai do modo da conta; a parceria escolhida e aprovada vale como parceiro", () => {
  assert.equal(papelEmUso({ modo: "owner", parceiro: false }), "proprietario");
  assert.equal(papelEmUso({ modo: "tenant", parceiro: false }), "morador");
  assert.equal(papelEmUso({ modo: "owner", parceiro: true }), "parceiro");
  assert.equal(papelEmUso({ modo: "tenant", parceiro: true }), "parceiro");
  // Conta nova, sem modo decidido: não é proprietário.
  assert.equal(papelEmUso({ modo: null, parceiro: false }), "morador");
});

test("E1125 (1): o cartão só existe no papel de proprietário — nunca para o morador, nem para a dona em modo morador", () => {
  assert.equal(podeVerOCartao({ dono: true, papel: "proprietario" }), true, "dono, no papel de dono");
  assert.equal(podeVerOCartao({ dono: true, papel: "morador" }), false, "conta de dono a usar o painel como moradora");
  assert.equal(podeVerOCartao({ dono: true, papel: "parceiro" }), false, "conta de dono no papel de parceiro (o avaliador)");
  assert.equal(podeVerOCartao({ dono: false, papel: "morador" }), false, "moradora pura");
  assert.equal(podeVerOCartao({ dono: false, papel: "proprietario" }), false, "sem imóvel nem cadastro de dono");
  assert.equal(podeVerOCartao({ dono: true, papel: null }), false, "papel não lido: sem cartão");
});

test("E1125 (1): a grade lê o papel em uso no servidor e só então devolve o cartão", () => {
  const servidor = semComentarios(ler("src/lib/vistoria/servico-avaliacao.ts"));
  assert.match(servidor, /resolveInitialMode\(\)/, "o modo é o mesmo do painel (fonte única)");
  assert.match(servidor, /papelInicialDoServidor\(\)/, "a parceria é a mesma leitura do cabeçalho");
  assert.match(servidor, /podeVerOCartao\(/);
  // O cartão continua a nascer só de avaliacaoNaGrade, e só na página de Serviços.
  const pagina = semComentarios(ler("src/app/(dashboard)/dashboard/servicos/page.tsx"));
  assert.match(pagina, /avaliacaoNaGrade\(\)/);
  const visao = semComentarios(ler("src/app/(dashboard)/dashboard/visao-geral-client.tsx"));
  assert.doesNotMatch(visao, /<ServicosPainel[^>]*avaliacao=/, "a Visão geral (morador e dono) não passa o cartão");
});

test("E1125 (2): uma avaliação em curso → direto a ela; nenhuma ou mais de uma → a porta", () => {
  const a = imovel("a");
  const b = imovel("b", "2026-11-20T10:00:00Z");
  const c = imovel("c", "2026-11-22T10:00:00Z");
  assert.equal(hrefDoCartaoDaAvaliacao({ chaveAberta: true, imoveis: [a, b] }), hrefDaAvaliacaoNoImovel("b"), "uma só: o pedido dela");
  assert.equal(hrefDoCartaoDaAvaliacao({ chaveAberta: true, imoveis: [a] }), HREF_PORTA_AVALIACAO, "nenhuma: a porta");
  assert.equal(hrefDoCartaoDaAvaliacao({ chaveAberta: true, imoveis: [a, b, c] }), HREF_PORTA_AVALIACAO, "duas: a lista, nunca uma escolhida em silêncio");
  assert.equal(hrefDoCartaoDaAvaliacao({ chaveAberta: false, imoveis: [b, c] }), HREF_PORTA_AVALIACAO, "fora do piloto: a porta");
});

test("E1125 (2): a porta lista primeiro as avaliações em curso, da pedida mais recentemente para a mais antiga", () => {
  const semPedido1 = imovel("novo-sem-pedido");
  const antigo = imovel("antigo", "2026-11-01T12:00:00Z");
  const recente = imovel("recente", "2026-11-22T09:00:00Z");
  const semPedido2 = imovel("velho-sem-pedido");
  // A ordem de chegada é a dos imóveis (do criado por último para o primeiro), que não é a dos pedidos.
  const ordenada = ordenarParaAPorta([semPedido1, antigo, recente, semPedido2]);
  assert.deepEqual(ordenada.map((i) => i.id), ["recente", "antigo", "novo-sem-pedido", "velho-sem-pedido"]);
  // Não mexe na lista recebida.
  assert.deepEqual([semPedido1, antigo, recente, semPedido2].map((i) => i.id), ["novo-sem-pedido", "antigo", "recente", "velho-sem-pedido"]);
});

test("E1125 (2): a tela diz quantas estão em curso e de quando é cada pedido", () => {
  assert.equal(textoVariasEmCurso(2), "Você tem 2 avaliações em curso. Escolha qual abrir.");
  assert.equal(textoVariasEmCurso(3), "Você tem 3 avaliações em curso. Escolha qual abrir.");
  assert.equal(textoVariasEmCurso(1), null, "com uma só não há o que escolher");
  assert.equal(textoVariasEmCurso(0), null);
  // A data é a de Brasília: 02:30 UTC de 23/11 ainda é 22/11 em Brasília.
  assert.equal(linhaDoPedidoEmCurso("2026-11-23T02:30:00Z"), "Avaliação pedida em 22/11/2026");
  assert.equal(linhaDoPedidoEmCurso(null), null);
  const porta = semComentarios(ler("src/app/(dashboard)/dashboard/servicos/avaliacao/page.tsx"));
  assert.match(porta, /ordenarParaAPorta\(/);
  assert.match(porta, /textoVariasEmCurso\(/);
  assert.match(porta, /linhaDoPedidoEmCurso\(/);
  assert.match(porta, /codigoDoImovel\(/, "cada imóvel leva o código VN, que é como a pessoa o reconhece");
});
