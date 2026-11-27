/*
  E1102 (ORDEM-DUET-465) — "Ver o pedido" do avaliador abria a tela em branco e devolvia-o ao painel: o avaliador não
  abria o detalhe do próprio pedido. A causa: um pedido "designado" ao avaliador SEM a linha em vistoria_designacoes (a
  forma do pedido da massa de QA 0256, em produção para o UDI-002). A lista oferecia o link e o formulário; a tela não
  achava a designação e voltava ao painel; o formulário respondia "O prazo de 24 horas para responder já passou".
  Regras travadas aqui:
   1. sem a linha da designação, a etapa sai do próprio pedido (ele é do avaliador e está "designado"): a tela abre;
   2. a lista oferece "Ver o pedido" exatamente quando a tela abre (a mesma função decide);
   3. a tela não volta calada ao painel por falta da designação, nem por leitura que falhou;
   4. responder funciona: a linha que faltava nasce com a resposta (propor e recusar).
  Roda: node --test src/lib/vistoria/e1102-avaliador-abre-o-pedido.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { etapaDoPedido } from "./pedido-avaliador.ts";
import { relogioDoPedido } from "./relogio-do-pedido.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const AGORA = new Date("2026-11-22T15:00:00Z");
const h = (n: number) => new Date(AGORA.getTime() - n * 3_600_000).toISOString();
// A forma da massa 0256: designado, de teste, sem escolha do dono — e SEM a linha da designação (resposta undefined).
const massa = { status: "designado", resposta: undefined as string | null | undefined, proposta_em: null as string | null, proposta_aceita_em: null as string | null, teste: true, escolhido_em: null as string | null };

test("E1102 (1): sem a linha da designação, a etapa sai do próprio pedido — a tela abre", () => {
  assert.equal(etapaDoPedido(massa), "novo", "designado a este avaliador, sem resposta gravada: espera a resposta dele");
  // O pedido que o dono escolheu (piloto), sem a linha: com a proposta gravada no pedido, proposta enviada; aceita, aceito.
  const escolhido = { ...massa, escolhido_em: h(30) };
  assert.equal(etapaDoPedido(escolhido), "novo");
  assert.equal(etapaDoPedido({ ...escolhido, proposta_em: h(2) }), "proposta_enviada");
  assert.equal(etapaDoPedido({ ...escolhido, proposta_em: h(2), proposta_aceita_em: h(1) }), "aceito");
  // A avaliação de teste do credenciamento não tem aceite do dono (E1101): com a proposta gravada, aceito.
  assert.equal(etapaDoPedido({ ...massa, proposta_em: h(2) }), "aceito");
});

test("E1102: com a linha da designação, nada muda — e recusa, prazo vencido e ausência seguem sem a tela do pedido", () => {
  const p = { status: "designado", proposta_aceita_em: null as string | null, teste: false, escolhido_em: h(3) };
  assert.equal(etapaDoPedido({ ...p, resposta: null }), "novo");
  assert.equal(etapaDoPedido({ ...p, resposta: null, proposta_em: h(1) }), "novo", "a linha existe e está sem resposta: vale ela");
  assert.equal(etapaDoPedido({ ...p, resposta: "aceita" }), "proposta_enviada");
  assert.equal(etapaDoPedido({ ...p, resposta: "aceita", proposta_aceita_em: h(1) }), "aceito");
  for (const r of ["recusada", "expirada", "ausencia"]) assert.equal(etapaDoPedido({ ...p, resposta: r }), null, r);
  for (const status of ["pedido", "agendado", "realizada", "laudo_emitido", "cancelada"]) {
    assert.equal(etapaDoPedido({ ...p, status, resposta: undefined }), null, `${status}: não é a tela do pedido`);
  }
});

test("E1102: sem a linha, a tela não inventa prazo de resposta (nada vence esse pedido); com a proposta, o prazo é o do dono", () => {
  const base = { status: "designado", resposta: undefined, designadoEm: h(480), propostaEm: null as string | null, propostaAceitaEm: null, precisaDoAceite: true };
  assert.equal(relogioDoPedido(base, AGORA), null);
  assert.equal(relogioDoPedido({ ...base, propostaEm: h(1) }, AGORA)?.vez, "dono");
});

test("E1102 (2 e 3): a lista oferece 'Ver o pedido' pela mesma função da tela; a tela não volta calada ao painel", () => {
  const lista = semComentarios(ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx"));
  assert.match(lista, /\{etapaDoPedido\(\{ status: p\.status, resposta: r, proposta_em: p\.proposta_em, proposta_aceita_em: p\.proposta_aceita_em, teste: p\.teste, escolhido_em: p\.escolhido_em \}\) && \(\s*<ButtonLink href=\{`\/dashboard\/parceiro\/avaliacao\/\$\{p\.id\}`\}[^>]*data-testid="abrir-pedido">/);
  assert.doesNotMatch(lista, /p\.status === "designado" && \(r === null \|\| r === "aceita"\) && \(\s*<ButtonLink/, "a regra do link já não é uma segunda regra, à parte da tela");
  const tela = semComentarios(ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx"));
  // A etapa já não exige a linha da designação: sem ela, a resposta vai como undefined e a etapa sai do pedido.
  assert.doesNotMatch(tela, /dados && minha \? etapaDoPedido/, "a falta da designação não derruba a tela");
  assert.match(tela, /resposta: minha \? minha\.resposta : undefined, proposta_em: dados\.proposta_em/);
  // Leitura que falha cai no aviso do painel ("Tentar de novo"), antes de qualquer redirecionamento.
  const erro = tela.indexOf('if (erroPedido || erroDesignacoes) throw new Error("Não foi possível ler este pedido agora.");');
  const volta = tela.indexOf('if (!dados || !etapa) redirect("/dashboard/parceiro/avaliacao");');
  assert.ok(erro > 0 && volta > erro, "a falha de leitura é tratada antes da volta à lista");
});

test("E1102 (4): responder funciona sem a linha — propor e recusar gravam a resposta, criando a designação que faltava", () => {
  const srv = semComentarios(ler("src/lib/vistoria/servidor.ts"));
  const f = srv.slice(srv.indexOf("export async function registrarRespostaDoAvaliador("), srv.indexOf("export async function devolverAoDono("));
  assert.ok(f.length > 100);
  // Primeiro a designação aberta; só sem linha nenhuma é que cria — e nunca grava por cima de uma resposta.
  const atualiza = f.indexOf('.update({ resposta, respondido_em: quando })');
  const jaTem = f.indexOf("if (error || ja) return false;");
  const cria = f.indexOf(".insert({ pedido_id: pedidoId, avaliador_id: avaliadorId, designado_em:");
  assert.ok(atualiza > 0 && jaTem > atualiza && cria > jaTem, "ordem: atualiza a aberta → já respondida? não mexe → cria a que falta");
  assert.match(f, /\.is\("resposta", null\)/);
  assert.match(f, /resposta, respondido_em: quando \}\);\s*return !erroNova;/);
  const acoes = semComentarios(ler("src/lib/vistoria/actions.ts"));
  const propor = acoes.slice(acoes.indexOf("export async function proporPrecoEPrazo("), acoes.indexOf("async function comoDonoDoPedido("));
  assert.match(propor, /const gravou = await registrarRespostaDoAvaliador\(c\.admin, c\.p\.id, c\.p\.avaliador_id!, "aceita",/);
  assert.match(propor, /if \(!gravou\) \{/);
  const recusar = acoes.slice(acoes.indexOf("export async function responderDesignacao("), acoes.indexOf("export async function escolherAvaliador("));
  const grava = recusar.indexOf('await registrarRespostaDoAvaliador(c.admin, c.p.id, c.p.avaliador_id!, "recusada", agora);');
  const devolve = recusar.indexOf('await devolverAoDono(c.admin, c.p.id, c.p.avaliador_id!, "recusada", agora);');
  assert.ok(grava > 0 && devolve > grava, "a recusa é gravada antes de o pedido voltar ao dono");
  // As duas ações só chegam aqui depois de conferir que a sessão é do avaliador do pedido e que ele está "designado".
  assert.match(propor, /const c = await comoAvaliador\(String\(form\.get\("pedidoId"\) \?\? ""\)\);\s*if \(!c \|\| c\.p\.status !== "designado"\) return SEM_ACESSO;/);
  assert.match(recusar, /const c = await comoAvaliador\(String\(form\.get\("pedidoId"\) \?\? ""\)\);\s*if \(!c \|\| c\.p\.status !== "designado"\) return SEM_ACESSO;/);
});

// ORDEM-DUET-492 (acrescento ao E1102): o pedido designado sem a linha da designação espera a resposta do avaliador;
// o lugar dele é "Para responder", não "Visitas". O filtro lia só `resposta.get(p.id) === null` (a linha aberta).
test("E1102 (ORDEM-492): 'Para responder' é a etapa \"novo\" — o pedido designado sem designação entra ali, sem relógio e sem formulário", () => {
  // Só os comentários de linha saem: o `accept="image/*"` do formulário de credenciamento abriria um bloco falso aqui.
  const lista = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx").replace(/^\s*\/\/.*$/gm, "");
  // A secção sai da mesma função que decide a tela e o "Ver o pedido".
  assert.match(lista, /const etapaNaLista = \(p: Pedido\) =>\s*etapaDoPedido\(\{ status: p\.status, resposta: resposta\.get\(p\.id\), proposta_em: p\.proposta_em, proposta_aceita_em: p\.proposta_aceita_em, teste: p\.teste, escolhido_em: p\.escolhido_em \}\);/);
  assert.match(lista, /const paraResponder = lista\.filter\(\(p\) => etapaNaLista\(p\) === "novo"\);/);
  assert.doesNotMatch(lista, /resposta\.get\(p\.id\) === null/, "a linha aberta deixou de ser o critério");
  // O item recebe a resposta lida (undefined quando não há linha): com `null` fixo, o órfão ganharia relógio e formulário.
  assert.doesNotMatch(lista, /<ItemPedido[^>]*resposta=\{null\}/);
  // A regra, nos três estados que a lista distingue:
  const p = { status: "designado", proposta_em: null as string | null, proposta_aceita_em: null, teste: true, escolhido_em: null };
  assert.equal(etapaDoPedido({ ...p, resposta: null }), "novo", "linha aberta: para responder (como antes)");
  assert.equal(etapaDoPedido({ ...p, resposta: undefined }), "novo", "sem linha e sem proposta: para responder (o órfão)");
  assert.notEqual(etapaDoPedido({ ...p, resposta: undefined, proposta_em: "2026-11-20T12:00:00Z" }), "novo", "sem linha, com proposta: já respondeu");
  assert.notEqual(etapaDoPedido({ ...p, resposta: "aceita", proposta_em: "2026-11-20T12:00:00Z" }), "novo");
  assert.equal(etapaDoPedido({ ...p, status: "agendado", resposta: undefined }), null, "só o pedido designado espera resposta");
  // E o órfão em "Para responder" não ganha relógio: sem relógio, a lista não mostra prazo nem o formulário antigo.
  assert.equal(relogioDoPedido({ status: "designado", resposta: undefined, designadoEm: "2026-11-01T12:00:00Z", propostaEm: null, propostaAceitaEm: null, precisaDoAceite: false }, new Date("2026-11-22T12:00:00Z")), null);
  assert.match(lista, /\{prazo && \(\s*<div[^>]*>\s*<span[^>]*data-testid="prazo-resposta"/, "prazo e formulário só existem com relógio do avaliador");
});

