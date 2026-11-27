import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ERRO_ACEITE_FORA_DO_PRAZO, aceiteForaDoPrazo, prazoDoAceiteTerminou, relogioDoPedido, textoDoPrazoDeAceiteParaODono } from "./relogio-do-pedido.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1147 (ORDENS-DUET 629 e 678; linha Parceiros, classe B). Entre o fim das 72 horas do dono e a rotina que devolve o
  pedido (corre de hora em hora), o bloco do dono continuava a mostrar "Aceite em até 72 horas…" e o botão "Aceitar
  valor e prazo" — que o servidor já recusa desde o E1142. Nessa janela o bloco passa a dizer que o prazo terminou (a
  frase aprovada, a mesma da recusa) e o botão de aceitar sai. "Escolher outro avaliador" fica: a troca não confere o
  prazo, e é por ela que o pedido volta já para o dono.
  O sinal é o relógio da própria renderização — a mesma conta que recusa o aceite. Não espera a rotina.
  Roda: node --test src/lib/vistoria/e1147-bloco-do-dono-com-o-prazo-terminado.test.ts
*/
const ler = (p: string) => readFileSync(p, "utf8");
const HORA = 3_600_000;
const PROPOSTA = "2026-11-24T06:46:00.000Z";
const estado = { status: "designado", resposta: undefined, designadoEm: null, propostaEm: PROPOSTA, propostaAceitaEm: null as string | null, precisaDoAceite: true };
const depoisDe = (horas: number, minutos = 0) => new Date(Date.parse(PROPOSTA) + horas * HORA + minutos * 60_000);

test("E1147: o sinal do bloco é a mesma conta que recusa o aceite — ao minuto, sem esperar a rotina", () => {
  const pedido = { propostaEm: PROPOSTA, teste: false, escolhidoEm: "2026-11-24T05:00:00.000Z" };
  for (const agora of [depoisDe(0), depoisDe(71), depoisDe(71, 59), depoisDe(72), depoisDe(72, 1), depoisDe(73), depoisDe(200)]) {
    const noBloco = prazoDoAceiteTerminou(relogioDoPedido(estado, agora));
    assert.equal(noBloco, aceiteForaDoPrazo(pedido, agora), `às ${agora.toISOString()} o bloco e a ação dizem o mesmo`);
  }
  assert.equal(prazoDoAceiteTerminou(relogioDoPedido(estado, depoisDe(71, 59))), false, "dentro do prazo: o aceite continua");
  assert.equal(prazoDoAceiteTerminou(relogioDoPedido(estado, depoisDe(72, 1))), true, "passadas as 72 horas: terminou");
});

test("E1147: só o prazo do DONO vencido conta — sem relógio, com o aceite dado ou na vez do avaliador, nada muda", () => {
  assert.equal(prazoDoAceiteTerminou(null), false);
  // Proposta já aceita: não há prazo de aceite a correr.
  assert.equal(prazoDoAceiteTerminou(relogioDoPedido({ ...estado, propostaAceitaEm: "2026-11-25T00:00:00.000Z" }, depoisDe(100))), false);
  // A avaliação de teste do credenciamento não passa pelo aceite do dono.
  assert.equal(prazoDoAceiteTerminou(relogioDoPedido({ ...estado, precisaDoAceite: false }, depoisDe(100))), false);
  // O relógio do avaliador (antes da proposta), mesmo vencido, não é o prazo do dono.
  const doAvaliador = relogioDoPedido({ ...estado, resposta: null, designadoEm: PROPOSTA, propostaEm: null }, depoisDe(100))!;
  assert.equal(doAvaliador.vez, "avaliador");
  assert.equal(doAvaliador.vencido, true);
  assert.equal(prazoDoAceiteTerminou(doAvaliador), false);
});

test("E1147: com o prazo terminado o dono lê a frase aprovada — a mesma da recusa do aceite; no prazo, a frase de sempre", () => {
  const vencido = relogioDoPedido(estado, depoisDe(72, 1))!;
  assert.equal(textoDoPrazoDeAceiteParaODono(vencido), ERRO_ACEITE_FORA_DO_PRAZO);
  assert.equal(ERRO_ACEITE_FORA_DO_PRAZO, "O prazo de 72 horas para aceitar esta proposta terminou. O pedido volta para você escolher de novo.");
  assert.doesNotMatch(textoDoPrazoDeAceiteParaODono(vencido), /Aceite em até/, "não convida a aceitar o que já não pode ser aceito");
  // Dentro do prazo nada muda (E1154).
  assert.equal(textoDoPrazoDeAceiteParaODono(relogioDoPedido(estado, depoisDe(10))!), "Aceite em até 72 horas depois da proposta, até 27/11/2026 03:46 (horário de Brasília); passado o prazo, você escolhe outro avaliador.");
});

test("E1147: no bloco do dono, o botão de aceitar sai com o prazo terminado; 'Escolher outro avaliador' fica", () => {
  const bloco = semComentarios(ler("src/components/vistoria/bloco-avaliacao-dono.tsx"));
  assert.match(bloco, /const aceiteTerminou = prazoDoAceiteTerminou\(relogioDoAceite\);/, "o sinal sai do relógio da renderização");
  const cartao = bloco.slice(bloco.indexOf('data-testid="avaliacao-proposta"'), bloco.indexOf('data-testid="avaliacao-aceite-confirmado"'));
  // O formulário do aceite só existe dentro da condição; fora dela não há outro.
  assert.match(cartao, /\{!aceiteTerminou && \(\s*<FormAcao acao=\{aceitarProposta\} testid="aceitar-proposta">[\s\S]*?<\/FormAcao>\s*\)\}/);
  assert.equal((cartao.match(/acao=\{aceitarProposta\}/g) ?? []).length, 1);
  // A troca de avaliador fica fora da condição: aparece com o prazo a correr e com ele terminado.
  const semOAceite = cartao.replace(/\{!aceiteTerminou && \(\s*<FormAcao[\s\S]*?<\/FormAcao>\s*\)\}/, "");
  assert.match(semOAceite, /<TrocaDeAvaliador\s+pedidoId=\{atual\.id\}\s+acao=\{recusarProposta\}/);
  // A tela marca o estado, para a trava de tela ler sem depender do texto.
  assert.match(cartao, /data-testid="avaliacao-proposta-prazo" data-terminado=\{aceiteTerminou \? "1" : "0"\}/);
});

test("E1147: a troca de avaliador não confere o prazo — por isso o botão funciona na janela (condição da ORDEM-678)", () => {
  const acoes = semComentarios(ler("src/lib/vistoria/actions.ts"));
  const inicio = acoes.indexOf("export async function recusarProposta(");
  const recusar = acoes.slice(inicio, acoes.indexOf("export async function", inicio + 10));
  assert.ok(inicio > 0 && recusar.length > 100);
  assert.doesNotMatch(recusar, /aceiteForaDoPrazo|ERRO_ACEITE_FORA_DO_PRAZO|prazoDoAceiteTerminou/, "a troca não recusa pelo prazo");
  assert.match(recusar, /devolverAoDono\(c\.admin, c\.p\.id, c\.p\.avaliador_id!, "descartada", new Date\(\)\)/);
  // O aceite continua a recusar no servidor (E1142): tirar o botão da tela não substitui a guarda.
  const aceitar = acoes.slice(acoes.indexOf("export async function aceitarProposta("), inicio);
  assert.match(aceitar, /if \(aceiteForaDoPrazo\([\s\S]*?\)\) \{\s*return \{ ok: false, erro: ERRO_ACEITE_FORA_DO_PRAZO \};/);
});
