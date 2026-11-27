import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registrarSemAvaliador, type FilaSemAvaliador, type ItemAberto } from "./fila-sem-avaliador.ts";
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1149 (ORDENS-DUET 638 e 678; linha Parceiros, classe B). O e-mail "Avaliação sem avaliador elegível" saía para todos
  os admins CADA VEZ que a escolha de um pedido era aberta sem ninguém para o dono escolher — e a rotina (de hora em
  hora) reabre a escolha de cada pedido parado. Era N pedidos × cada admin × cada hora.
  O aviso passa a sair só quando o item da fila do admin é NOVO ou o MOTIVO muda. A marca é o próprio item aberto (um por
  pedido, com índice único): sem coluna nova, sem migração. Quem perde a corrida do insert não avisa.
  Roda: node --test src/lib/vistoria/e1149-aviso-sem-avaliador-uma-vez.test.ts
*/

/** A fila do admin para UM pedido, em memória, com o que o banco garante: um item aberto por pedido (índice único). */
function filaDeUmPedido() {
  let seq = 0;
  let aberto: ItemAberto | null = null;
  const fila: FilaSemAvaliador = {
    aberto: async () => (aberto ? { ...aberto } : null),
    // O índice único deixa entrar um só: o segundo insert falha.
    inserir: async (motivo) => {
      await Promise.resolve();
      if (aberto) return false;
      aberto = { id: `item-${++seq}`, motivo };
      return true;
    },
    // A troca só pega se o item ainda tem o motivo que quem troca leu.
    mudarMotivo: async (item, motivo) => {
      await Promise.resolve();
      if (!aberto || aberto.id !== item.id || aberto.motivo !== item.motivo) return false;
      aberto = { ...aberto, motivo };
      return true;
    },
  };
  return { fila, estado: () => aberto, resolver: () => void (aberto = null), porTextoAntigo: (motivo: string | null) => void (aberto = { id: `item-${++seq}`, motivo }) };
}
/** Quantos avisos saem: um por chamada que não deu "igual" (é o que `abrirEscolha` faz com o resultado). */
const avisos = (r: string[]) => r.filter((x) => x !== "igual").length;
const A = "Uberlândia: nº UDI-001: a última avaliação deste imóvel foi dele.";
const B = "Uberlândia: nº UDI-001: a última avaliação deste imóvel foi dele. nº UDI-002: conta de teste.";

test("E1149: duas aberturas seguidas sem avaliador dão UM aviso; a rotina de hora em hora não repete", async () => {
  const { fila, estado } = filaDeUmPedido();
  const r = [await registrarSemAvaliador(fila, A), await registrarSemAvaliador(fila, A)];
  assert.deepEqual(r, ["novo", "igual"]);
  assert.equal(avisos(r), 1);
  // 24 tiques da rotina com o pedido parado pelo mesmo motivo: nenhum aviso a mais.
  for (let h = 0; h < 24; h++) r.push(await registrarSemAvaliador(fila, A));
  assert.equal(avisos(r), 1, "um dia inteiro de rotina, um aviso só");
  assert.equal(estado()?.motivo, A);
});

test("E1149: o aviso volta a sair quando o motivo muda — e só nessa vez", async () => {
  const { fila, estado } = filaDeUmPedido();
  const r = [await registrarSemAvaliador(fila, A), await registrarSemAvaliador(fila, A), await registrarSemAvaliador(fila, B)];
  assert.deepEqual(r, ["novo", "igual", "motivo_mudou"]);
  assert.equal(avisos(r), 2);
  assert.equal(estado()?.motivo, B, "o item fica com o motivo novo (E1146)");
  r.push(await registrarSemAvaliador(fila, B), await registrarSemAvaliador(fila, B));
  assert.equal(avisos(r), 2, "com o motivo novo já gravado, a rotina não repete");
});

test("E1149: o item que já estava aberto com o texto antigo recebe o motivo (E1146) e avisa uma vez", async () => {
  const { fila, estado, porTextoAntigo } = filaDeUmPedido();
  porTextoAntigo("Nenhum avaliador disponível para o dono escolher em Uberlândia.");
  const r = [await registrarSemAvaliador(fila, A), await registrarSemAvaliador(fila, A)];
  assert.deepEqual(r, ["motivo_mudou", "igual"]);
  assert.equal(estado()?.motivo, A);
  // E o item sem motivo nenhum (nulo no banco).
  const outra = filaDeUmPedido();
  outra.porTextoAntigo(null);
  assert.deepEqual([await registrarSemAvaliador(outra.fila, A), await registrarSemAvaliador(outra.fila, A)], ["motivo_mudou", "igual"]);
});

test("E1149: a rotina e uma ação do dono ao mesmo tempo — as duas veem a fila vazia, só quem inseriu avisa", async () => {
  const { fila } = filaDeUmPedido();
  const r = await Promise.all([registrarSemAvaliador(fila, A), registrarSemAvaliador(fila, A), registrarSemAvaliador(fila, A)]);
  assert.equal(r.filter((x) => x === "novo").length, 1, "o índice único deixa entrar um só");
  assert.equal(avisos(r), 1);
  // O mesmo na mudança de motivo: as duas leem o motivo antigo, só uma o troca.
  const m = await Promise.all([registrarSemAvaliador(fila, B), registrarSemAvaliador(fila, B)]);
  assert.equal(avisos(m), 1);
});

test("E1149: resolvido o item (apareceu avaliador), um novo impedimento é um item novo — e avisa", async () => {
  const { fila, resolver } = filaDeUmPedido();
  const r = [await registrarSemAvaliador(fila, A)];
  resolver();
  r.push(await registrarSemAvaliador(fila, A), await registrarSemAvaliador(fila, A));
  assert.deepEqual(r, ["novo", "novo", "igual"]);
});

test("E1149: no servidor, o aviso só sai pelo resultado da fila — e `naFilaDoAdmin` devolve se inseriu", () => {
  const servidor = fonteSemComentarios(readFileSync("src/lib/vistoria/servidor.ts", "utf8"));
  // A função da fila devolve se inseriu (antes devolvia nada, e as duas chamadas em corrida avisavam).
  // E1185 (ORDEM-DUET-799): o erro passa pela leitura do E1182; continua a devolver `true` só se ESTA chamada inseriu.
  assert.match(servidor, /export async function naFilaDoAdmin\([^)]*\): Promise<boolean> \{\s*const \{ error \} = await admin\.from\("vistoria_fila_admin"\)\.insert\(\{[^}]*\}\);\s*return lerGravacaoNaFila\(error, \{ tipo, pedidoId: ref\.pedidoId, avaliadorId: ref\.avaliadorId \}\)\.inserido;\s*\}/);
  const abrir = servidor.slice(servidor.indexOf("export async function abrirEscolha"), servidor.indexOf("export async function sugeridosDoPedido"));
  assert.match(abrir, /const mudanca = await registrarSemAvaliador\(/);
  // O aviso está atrás do resultado: nunca solto no ramo "sem sugeridos".
  assert.match(abrir, /if \(mudanca !== "igual"\) await avisarAdmins\(admin, "vistoria_sem_avaliador"\);/);
  assert.equal((servidor.match(/avisarAdmins\(admin, "vistoria_sem_avaliador"\)/g) ?? []).length, 1, "um ponto só de envio deste aviso");
  // A fila usa o insert que diz se inseriu, e a troca de motivo só pega se o motivo ainda é o que se leu.
  assert.match(abrir, /inserir: \(m\) => naFilaDoAdmin\(admin, "sem_avaliador", \{ pedidoId: p\.id \}, m\)/);
  assert.match(abrir, /\.update\(\{ motivo: m \}\)\.eq\("id", item\.id\)\.is\("resolvido_em", null\)/);
  assert.match(abrir, /item\.motivo === null \? troca\.is\("motivo", null\) : troca\.eq\("motivo", item\.motivo\)/);
  // Sem coluna nova: o item da fila é a marca (ORDEM-DUET-678: intervalo longo entre avisos não se faz).
  assert.doesNotMatch(servidor, /avisado_em/);
});
