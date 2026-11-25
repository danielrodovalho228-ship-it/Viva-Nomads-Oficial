/*
  E1104 (ORDEM-DUET-470, classe A) — a porta da avaliação estava escondida de quem quer começar: o cartão "Avaliação do
  imóvel" da grade de Serviços só aparecia para a conta com a avaliação já aberta (chave ou piloto). Um dono fora do
  piloto não via avaliadores em lugar nenhum. Regras travadas aqui:
   1. o cartão aparece para TODO dono; o morador não ganha o cartão;
   2. sem avaliação em curso, o cartão leva ao começo do pedido (a porta: escolher o imóvel);
      com avaliação em curso, leva ao pedido em curso;
   3. fora do piloto (chave fechada para a conta), o destino diz o estado honesto, nunca um beco — e não lê nem mostra
      nada da avaliação (nenhum avaliador vaza).
  Roda: node --test src/lib/vistoria/e1104-porta-da-avaliacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";
import {
  ANCORA_AVALIACAO_NO_IMOVEL,
  HREF_PORTA_AVALIACAO,
  ROTULO_PEDIR_NA_PORTA,
  ROTULO_VER_PEDIDO_NA_PORTA,
  STATUS_PEDIDO_EM_CURSO,
  acaoDoImovelNaPorta,
  ehDonoParaAPorta,
  estadoDaPorta,
  hrefDaAvaliacaoNoImovel,
  hrefDoCartaoDaAvaliacao,
  textoAChegar,
} from "./porta-da-avaliacao.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const imovel = (id: string, emCurso = false) => ({ id, titulo: `Casa ${id}`, cidade: "Uberlândia", emCurso, pedidoEm: emCurso ? "2026-11-20T12:00:00Z" : null });

test("E1104 (1): dono é quem tem imóvel ou se cadastrou como proprietário; o morador não ganha o cartão", () => {
  assert.equal(ehDonoParaAPorta({ imoveis: 1, role: "tenant" }), true, "tem imóvel");
  assert.equal(ehDonoParaAPorta({ imoveis: 0, role: "owner" }), true, "dono novo, ainda sem imóvel");
  assert.equal(ehDonoParaAPorta({ imoveis: 0, role: "tenant" }), false, "morador");
  assert.equal(ehDonoParaAPorta({ imoveis: 0, role: null }), false);
  assert.equal(ehDonoParaAPorta({ imoveis: 0, role: "admin" }), false, "admin sem imóvel não é dono");
});

test("E1104 (2): o destino do cartão — pedido em curso → o pedido; sem pedido → a porta", () => {
  assert.equal(HREF_PORTA_AVALIACAO, "/dashboard/servicos/avaliacao");
  assert.equal(hrefDaAvaliacaoNoImovel("abc"), `/dashboard/imoveis/abc/nivel#${ANCORA_AVALIACAO_NO_IMOVEL}`);
  // Sem avaliação em curso: a porta (começar o pedido).
  assert.equal(hrefDoCartaoDaAvaliacao({ chaveAberta: true, imoveis: [imovel("a"), imovel("b")] }), HREF_PORTA_AVALIACAO);
  assert.equal(hrefDoCartaoDaAvaliacao({ chaveAberta: true, imoveis: [] }), HREF_PORTA_AVALIACAO);
  // Com UMA avaliação em curso: direto ao pedido em curso.
  assert.equal(hrefDoCartaoDaAvaliacao({ chaveAberta: true, imoveis: [imovel("a"), imovel("b", true), imovel("c")] }), hrefDaAvaliacaoNoImovel("b"));
  // E1125 (ORDEM-DUET-539): antes, com duas em curso (b e c), o cartão ia para "b" (o primeiro da lista) sem dizer qual
  // tinha escolhido; agora, com mais de uma, vai para a porta, que as lista.
  assert.equal(hrefDoCartaoDaAvaliacao({ chaveAberta: true, imoveis: [imovel("a"), imovel("b", true), imovel("c", true)] }), HREF_PORTA_AVALIACAO);
  // Fora do piloto: sempre a porta, que diz o estado honesto (nunca a página do imóvel, onde o bloco não aparece).
  assert.equal(hrefDoCartaoDaAvaliacao({ chaveAberta: false, imoveis: [imovel("a", true)] }), HREF_PORTA_AVALIACAO);
  assert.deepEqual([...STATUS_PEDIDO_EM_CURSO], ["pedido", "designado", "agendado", "realizada"]);
});

test("E1104 (2 e 3): o estado da porta", () => {
  assert.equal(estadoDaPorta({ chaveAberta: false, imoveis: 3 }), "a_chegar");
  assert.equal(estadoDaPorta({ chaveAberta: false, imoveis: 0 }), "a_chegar");
  assert.equal(estadoDaPorta({ chaveAberta: true, imoveis: 0 }), "sem_imovel");
  assert.equal(estadoDaPorta({ chaveAberta: true, imoveis: 2 }), "escolher");
});

test("E1104 (2): na porta, cada imóvel leva ao seu pedido — 'Pedir avaliação' ou 'Ver o pedido em curso'", () => {
  assert.deepEqual(acaoDoImovelNaPorta(imovel("a")), { rotulo: ROTULO_PEDIR_NA_PORTA, href: hrefDaAvaliacaoNoImovel("a") });
  assert.deepEqual(acaoDoImovelNaPorta(imovel("b", true)), { rotulo: ROTULO_VER_PEDIDO_NA_PORTA, href: hrefDaAvaliacaoNoImovel("b") });
  assert.equal(ROTULO_PEDIR_NA_PORTA, "Pedir avaliação");
  assert.equal(ROTULO_VER_PEDIDO_NA_PORTA, "Ver o pedido em curso");
});

test("E1104 (3): o estado honesto fora do piloto — diz a cidade quando a conhece", () => {
  assert.equal(textoAChegar("Uberlândia").titulo, "A avaliação do imóvel ainda não chegou a Uberlândia");
  assert.equal(textoAChegar(null).titulo, "A avaliação do imóvel ainda não chegou à sua cidade");
  assert.equal(textoAChegar("Uberlândia").texto, "Estamos credenciando avaliadores e abrindo o serviço cidade por cidade. Quando abrir para a sua conta, o pedido aparece aqui e na página do nível de cada imóvel.");
});

test("E1104 (1 e 3): o servidor — todo dono ganha o cartão; com a chave fechada nada da avaliação é lido", () => {
  const srv = semComentarios(ler("src/lib/vistoria/servico-avaliacao.ts"));
  // O cartão já não depende da chave: quem decide é ser dono.
  const grade = srv.slice(srv.indexOf("export async function avaliacaoNaGrade("));
  assert.ok(grade.length > 20);
  assert.doesNotMatch(grade, /if \(!\(await vistoriaAtiva\(\)\)\) return null;/, "o cartão não some com a chave fechada");
  assert.match(grade, /hrefDoCartaoDaAvaliacao\(/);
  const porta = srv.slice(srv.indexOf("export async function portaDaAvaliacao("), srv.indexOf("export async function avaliacaoNaGrade("));
  assert.match(porta, /ehDonoParaAPorta\(/);
  assert.match(porta, /\.eq\("owner_id", user\.id\)/, "só os imóveis da própria conta");
  // Fechada para a conta: os pedidos de avaliação nem são lidos (o piloto continua fechado; nenhum avaliador vaza).
  const lePedidos = porta.indexOf('from("vistoria_pedidos")');
  const guarda = porta.indexOf("if (chaveAberta");
  assert.ok(lePedidos > 0 && guarda > 0 && guarda < lePedidos, "a leitura dos pedidos fica atrás da chave");
  assert.doesNotMatch(srv, /avaliadores_credenciamento|avaliadores_publicos/, "a porta não lê avaliadores");
});

test("E1104: a página de Serviços passa o cartão; a porta existe, recusa o morador e não mostra a avaliação com a chave fechada", () => {
  const servicos = ler("src/app/(dashboard)/dashboard/servicos/page.tsx");
  assert.match(servicos, /avaliacaoNaGrade\(\)/);
  assert.match(servicos, /<ServicosPainel cidade=\{cidade\} avaliacao=\{avaliacao\} \/>/);
  const pagina = semComentarios(ler("src/app/(dashboard)/dashboard/servicos/avaliacao/page.tsx"));
  assert.match(pagina, /portaDaAvaliacao\(\)/);
  assert.match(pagina, /redirect\("\/dashboard\/servicos"\)/, "o morador volta aos serviços");
  assert.match(pagina, /data-testid="porta-avaliacao"/);
  assert.match(pagina, /data-estado=\{estado\}/);
  assert.match(pagina, /textoAChegar\(/);
  assert.match(pagina, /acaoDoImovelNaPorta\(/);
  assert.doesNotMatch(pagina, /avaliadores_credenciamento|avaliadores_publicos|sugeridosDoPedido/, "a porta não lista avaliadores");
  // A âncora existe na página do nível, à volta do bloco da avaliação.
  const nivel = ler("src/app/(dashboard)/dashboard/imoveis/[id]/nivel/page.tsx");
  assert.match(nivel, /<AncoraDaAvaliacao id=\{ANCORA_AVALIACAO_NO_IMOVEL\}>\s*<BlocoAvaliacaoDono propertyId=\{id\} \/>/);
  // A página é longa e ainda cresce depois de aberta: a âncora mantém o bloco à vista enquanto ela assenta, e para
  // quando a pessoa mexe na tela. Sem a âncora no endereço, não faz nada.
  const ancora = semComentarios(ler("src/components/vistoria/ancora-da-avaliacao.tsx"));
  assert.match(ancora, /^"use client";/);
  assert.match(ancora, /window\.location\.hash !== `#\$\{id\}`\) return;/);
  assert.match(ancora, /new ResizeObserver\(alinhar\)/);
  assert.match(ancora, /scrollIntoView\(/);
  assert.match(ancora, /"wheel", "touchstart", "keydown", "pointerdown"/);
});
