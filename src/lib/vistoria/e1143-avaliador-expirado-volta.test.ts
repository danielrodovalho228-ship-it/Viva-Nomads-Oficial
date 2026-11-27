import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { designacaoQueVolta, jaDesignadosNoPedido } from "./regras.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1143 (ORDEM-DUET-626; decisão do Daniel de 24/11: "ele volta à lista"). A escolha do dono excluía para sempre todo
  avaliador que já tivesse tido uma designação naquele pedido. Quando a proposta expirava e não havia mais ninguém — a
  condição real de uma cidade com um avaliador só —, o dono ficava preso em "Aguardando avaliador".
  A regra: a exclusão olha para o MOTIVO do fim da designação anterior NAQUELE pedido.
   • o avaliador recusou → fica fora;
   • a proposta dele venceu sem o aceite do dono (a marca proposta_expirada_em, da migração 0359) → VOLTA à lista;
   • ele não respondeu no prazo dele (expirou sem proposta) → fica fora (regra do Gerente: o silêncio dele vale a recusa).
*/
const ler = (p: string) => readFileSync(p, "utf8");
const QUANDO = "2026-11-23T15:00:00.000Z";
const d = (avaliador_id: string, resposta: string | null, proposta_expirada_em: string | null = null) => ({ avaliador_id, resposta, proposta_expirada_em });

test("E1143: os três casos da ordem — recusa fora · proposta expirada dentro · sem resposta fora", () => {
  const recusou = d("a-recusou", "recusada");
  const propostaExpirou = d("a-proposta-expirou", "expirada", QUANDO);
  const semResposta = d("a-sem-resposta", "expirada", null);
  assert.equal(designacaoQueVolta(recusou), false);
  assert.equal(designacaoQueVolta(propostaExpirou), true, "o silêncio foi do dono: o avaliador volta a ser candidato");
  assert.equal(designacaoQueVolta(semResposta), false, "expirou sem proposta nenhuma: o silêncio foi do avaliador");
  assert.deepEqual(jaDesignadosNoPedido([recusou, propostaExpirou, semResposta]), ["a-recusou", "a-sem-resposta"]);
});

test("E1143: tudo o mais continua a excluir — a designação em curso, a proposta viva, a ausência", () => {
  assert.equal(designacaoQueVolta(d("a", null)), false, "designado, ainda sem responder");
  assert.equal(designacaoQueVolta(d("a", "aceita")), false, "com a proposta enviada (viva, ou descartada pelo dono)");
  assert.equal(designacaoQueVolta(d("a", "ausencia")), false, "faltou à visita");
  // A marca sozinha não reabre: só vale junto da resposta "expirada" (uma linha incoerente não devolve ninguém).
  assert.equal(designacaoQueVolta(d("a", "recusada", QUANDO)), false);
  assert.equal(designacaoQueVolta(d("a", "aceita", QUANDO)), false);
  assert.equal(designacaoQueVolta(d("a", "expirada", "")), false);
  assert.deepEqual(jaDesignadosNoPedido([]), []);
});

test("E1143: a leitura da escolha usa a regra (lê a resposta e a marca de cada designação do pedido)", () => {
  const srv = semComentarios(ler("src/lib/vistoria/servidor.ts"));
  const leitura = srv.slice(srv.indexOf("async function leituraDaEscolha("), srv.indexOf("export async function abrirEscolha("));
  assert.match(leitura, /from\("vistoria_designacoes"\)\.select\("avaliador_id, resposta, proposta_expirada_em"\)\.eq\("pedido_id", p\.id\)/);
  assert.match(leitura, /jaDesignados: jaDesignadosNoPedido\(/);
  assert.doesNotMatch(leitura, /jaDesignados: \(\(jaLeitura\.data/, "a exclusão já não é 'toda designação que existe'");
});

test("E1143: escolhido de novo, o avaliador que voltou reabre a MESMA designação (há uma por pedido e avaliador)", () => {
  const srv = semComentarios(ler("src/lib/vistoria/servidor.ts"));
  const escolher = srv.slice(srv.indexOf("export async function escolherNoServidor("), srv.indexOf("export async function registrarRespostaDoAvaliador("));
  // Reabre só a linha que a regra devolveu à lista: "expirada" COM a marca. Fica sem resposta e sem a marca.
  // E1177 (asserção alterada, ORDEM-DUET-778): a reabertura grava também se o escolhido é o mesmo da avaliação anterior.
  const reabre = escolher.indexOf('.update({ designado_em: quando, resposta: null, respondido_em: null, proposta_expirada_em: null, mesmo_da_anterior: a.mesmoDaAnterior === true })');
  assert.ok(reabre > 0, "falta reabrir a designação");
  assert.match(escolher.slice(reabre, reabre + 400), /\.eq\("pedido_id", l\.p\.id\)\s*\.eq\("avaliador_id", a\.id\)\s*\.eq\("resposta", "expirada"\)\s*\.not\("proposta_expirada_em", "is", null\)/);
  // Sem linha para reabrir, cria — como sempre.
  const cria = escolher.indexOf('.insert({ pedido_id: l.p.id, avaliador_id: a.id, designado_em: quando, mesmo_da_anterior: a.mesmoDaAnterior === true })');
  assert.ok(cria > reabre, "primeiro tenta reabrir; só sem linha é que cria");
  // E só é escolhido quem está entre os sugeridos (a mesma leitura): a reabertura não é uma porta à parte.
  assert.ok(escolher.indexOf("l.sugestoes.sugeridos.find(") < reabre);
});

test("E1143: quem recusou ou não respondeu não reabre nada — a rotina e as ações não mudam o registo deles", () => {
  const srv = semComentarios(ler("src/lib/vistoria/servidor.ts"));
  const devolver = srv.slice(srv.indexOf("export async function devolverAoDono("), srv.indexOf("export async function registrarPropostaExpirada("));
  assert.doesNotMatch(devolver, /proposta_expirada_em: (?!null)/, "devolverAoDono nunca põe a marca: só registrarPropostaExpirada põe");
  const reg = srv.slice(srv.indexOf("export async function registrarPropostaExpirada("), srv.indexOf("export async function revisarCriterios("));
  assert.match(reg, /\.eq\("resposta", "aceita"\)/, "a marca só entra na designação que tinha a proposta enviada");
});
