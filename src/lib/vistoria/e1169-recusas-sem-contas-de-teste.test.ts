import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { separarContasDeTeste, textoDasContasDeTeste } from "./contagens-da-central.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1169 (ORDEM-DUET-738; linha Parceiros). A lista "Recusas e ausências (30 dias)" de /admin/avaliadores misturava as
  recusas de conta de teste com as de conta real, e o número do topo "recusas e ausências" contava-as. Vale a regra do
  E1163: o número e a lista de trabalho da equipe não levam a massa de teste; a conta de teste (o dono do pedido)
  aparece à parte, no bloco "Mais N de conta de teste, fora do número:".
  Roda: node --test src/lib/vistoria/e1169-recusas-sem-contas-de-teste.test.ts
*/
const PAGINA = semComentarios(readFileSync("src/app/(dashboard)/admin/avaliadores/page.tsx", "utf8"));
const PAINEL = PAGINA.slice(PAGINA.indexOf('data-testid="avaliacoes-recusas"'), PAGINA.indexOf('data-testid="propostas-expiradas"'));

type Recusa = { id: string; respondido_em: string; vistoria_pedidos: { cidade: string; owner_id: string | null } | null };
const recusa = (id: string, dono: string | null, quando = "2026-11-20T10:00:00.000Z"): Recusa => ({ id, respondido_em: quando, vistoria_pedidos: dono === "sem-pedido" ? null : { cidade: "Uberlândia", owner_id: dono } });

test("E1169: a recusa de conta de teste sai do número e da lista de trabalho — pelo dono do pedido", () => {
  const s = separarContasDeTeste(
    [recusa("real", "dono-real"), recusa("de-teste", "dono-de-teste"), recusa("sem-dono", null), recusa("orfa", "sem-pedido")],
    (r) => r.vistoria_pedidos?.owner_id,
    (r) => r.respondido_em,
    new Set(["dono-de-teste"]),
  );
  assert.equal(s.n, 3, "o número é o tamanho da lista de trabalho");
  assert.deepEqual(s.reais.map((r) => r.id), ["real", "sem-dono", "orfa"], "sem dono conhecido conta como real: só sai o que se sabe ser de teste");
  assert.deepEqual(s.deTeste.map((r) => r.id), ["de-teste"]);
});

test("E1169: a página lê o dono do pedido e separa as recusas com as contas de teste da Central", () => {
  assert.match(PAGINA, /select\("id, resposta, respondido_em, avaliador_id, vistoria_pedidos\(cidade, owner_id\)"\)/);
  assert.match(PAGINA, /const recusasDaCentral = separarContasDeTeste\(\(recusas \?\? \[\]\) as unknown as RecusaDaLista\[\], \(r\) => r\.vistoria_pedidos\?\.owner_id, \(r\) => r\.respondido_em, contasDeTesteDaCentral\);/);
  assert.match(PAGINA, /const recusasLista = recusasDaCentral\.reais;/);
  assert.match(PAGINA, /const recusasDeTeste = recusasDaCentral\.deTeste;/);
});

test("E1169: o número do topo é o tamanho da lista de trabalho — as de conta de teste não contam", () => {
  assert.match(PAGINA, /recusasAusencias: recusasLista\.length,/);
  assert.doesNotMatch(PAGINA, /recusasAusencias: [^,]*recusasDeTeste/);
  assert.doesNotMatch(PAGINA, /recusasAusencias: \(recusas \?\? \[\]\)/);
});

test("E1169: as recusas de conta de teste ficam num bloco próprio, por baixo da lista de trabalho, com o texto da casa", () => {
  assert.equal(textoDasContasDeTeste(1), "Mais 1 de conta de teste, fora do número:");
  assert.match(PAINEL, /data-testid="recusas-de-teste" data-valor=\{recusasDeTeste\.length\}/);
  assert.match(PAINEL, /<p>\{textoDasContasDeTeste\(recusasDeTeste\.length\)\}<\/p>/);
  assert.match(PAINEL, /\{recusasLista\.map\(\(r\) => itemDaRecusa\(r, "nao"\)\)\}/);
  assert.match(PAINEL, /\{recusasDeTeste\.map\(\(r\) => itemDaRecusa\(r, "sim"\)\)\}/);
  assert.ok(PAINEL.indexOf("recusasLista.map(") < PAINEL.indexOf("recusasDeTeste.map("), "primeiro a lista de trabalho, depois o bloco de teste");
  // Cada linha diz de que lado está; a linha é uma só para os dois lados.
  assert.match(PAGINA, /<li key=\{r\.id\} data-testid="recusa-item" data-resposta=\{r\.resposta\} data-conta-teste=\{contaTeste\}>/);
  assert.equal((PAGINA.match(/data-testid="recusa-item"/g) ?? []).length, 1);
});

test("E1169: 'Nenhuma recusa ou ausência' só aparece quando não há nenhuma — nem real nem de teste", () => {
  assert.match(PAINEL, /\{recusasLista\.length === 0 && recusasDeTeste\.length === 0 && <p className="text-sm text-muted">Nenhuma recusa ou ausência nos últimos \{DIAS_DA_JANELA_DE_RECUSAS\} dias\.<\/p>\}/);
});
