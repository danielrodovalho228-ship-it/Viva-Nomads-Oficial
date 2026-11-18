/*
  t2014 · E200 + E569 (Pista 3, lote 2, item A1) @E200 @E569 @ao-vivo-seguro
  Regra, como está escrita em src/lib/mensagens/conversa-pedida.ts e na lista (src/lib/data/messages.ts):
    • uma conversa existe pela MENSAGEM trocada — sem precisar de candidatura nem de contrato;
    • a conversa de cada CONTRATO em que a pessoa é parte entra na lista desde a criação, vazia (E200);
    • a de cada CANDIDATURA em andamento (nova ou aceita) também entra, vazia (E569); recusada/encerrada não cria;
    • o id é o mesmo para as duas pessoas + imóvel: mensagem, contrato e candidatura do mesmo par no mesmo imóvel são
      UMA conversa; contrato ou candidatura de que a pessoa não é parte nunca vira conversa dela;
    • a conversa pedida no link só abre se está na lista; senão nenhuma abre (nunca a 1ª, de outra pessoa).
  Roda o listConversations REAL (dublês só nas bordas, ver src/lib/messages/conversa-harness/).
  Roda: node --test src/lib/mensagens/e200-t2014-origem-da-conversa.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { U, novoMundo } from "../messages/conversa-harness/supabase-falso.ts";
import { conversationId } from "../messages/conversation-id.ts";
import { conversaInicial } from "./conversa-pedida.ts";

const { listConversations } = await import("../data/messages.ts");
const IMOVEIS = [
  { id: U.imovel, owner_id: U.dono, title: "Apto Centro" },
  { id: U.imovel2, owner_id: U.outro, title: "Casa Praia" },
];
const conv = (a: string, b: string, p?: string) => conversationId(a, b, p);

function mensagem(de: string, para: string, imovel: string | null, texto: string, em: string) {
  const p = IMOVEIS.find((i) => i.id === imovel);
  return { id: `m-${em}`, conversation_id: conv(de, para, imovel ?? undefined), sender_id: de, receiver_id: para, property_id: imovel, body: texto, created_at: em, proposta_id: null, parceiro_pedido_id: null, lido_em: null, property: p ? { title: p.title, owner_id: p.owner_id } : null };
}
function contrato(id: string, tenant: string, imovel: string) {
  const p = IMOVEIS.find((i) => i.id === imovel)!;
  return { id, tenant_id: tenant, property_id: imovel, created_at: "2026-11-01", properties: { title: p.title, owner_id: p.owner_id } };
}
function candidatura(id: string, tenant: string, imovel: string, status: string) {
  const p = IMOVEIS.find((i) => i.id === imovel)!;
  return { id, owner_id: p.owner_id, tenant_id: tenant, property_id: imovel, status, created_at: "2026-11-01", property: { title: p.title } };
}
async function lista(eu: string, t: { messages?: unknown[]; contratos?: unknown[]; leads?: unknown[] }) {
  novoMundo({ properties: IMOVEIS.map((i) => ({ ...i })), messages: (t.messages ?? []) as never, contratos: (t.contratos ?? []) as never, leads: (t.leads ?? []) as never }, eu, { servico: false });
  return listConversations({ exigir: true });
}

test("A1: conversa só de mensagem — sem candidatura e sem contrato — está na lista dos dois lados, com as mensagens", async () => {
  const msgs = [mensagem(U.morador, U.dono, U.imovel, "Olá, o apartamento está livre?", "2026-11-10T12:00:00Z"), mensagem(U.dono, U.morador, U.imovel, "Está sim.", "2026-11-10T12:05:00Z")];
  for (const [eu, outro] of [[U.morador, U.dono], [U.dono, U.morador]]) {
    const l = await lista(eu, { messages: msgs });
    assert.equal(l.length, 1);
    assert.equal(l[0].id, conv(U.morador, U.dono, U.imovel));
    assert.equal(l[0].otherId, outro);
    assert.deepEqual(l[0].messages.map((m) => m.text), ["Olá, o apartamento está livre?", "Está sim."]);
  }
});

test("A1 (E200): contrato sem mensagem — a conversa entra vazia, com a outra parte e o contrato", async () => {
  const l = await lista(U.morador, { contratos: [contrato("ct-1", U.morador, U.imovel)] });
  assert.equal(l.length, 1);
  assert.deepEqual([l[0].id, l[0].otherId, l[0].contratoId, l[0].messages.length, l[0].papel], [conv(U.morador, U.dono, U.imovel), U.dono, "ct-1", 0, "inquilino"]);
  const doDono = await lista(U.dono, { contratos: [contrato("ct-1", U.morador, U.imovel)] });
  assert.deepEqual([doDono.length, doDono[0].otherId, doDono[0].papel], [1, U.morador, "proprietario"]);
});

test("A1 (E569): candidatura nova ou aceita cria a conversa vazia; recusada ou encerrada não cria", async () => {
  for (const status of ["new", "accepted"]) {
    const l = await lista(U.dono, { leads: [candidatura("ld-1", U.morador, U.imovel, status)] });
    assert.equal(l.length, 1, status);
    assert.deepEqual([l[0].id, l[0].otherId, l[0].contratoId], [conv(U.morador, U.dono, U.imovel), U.morador, undefined], status);
  }
  for (const status of ["declined", "closed", "archived"]) assert.equal((await lista(U.dono, { leads: [candidatura("ld-1", U.morador, U.imovel, status)] })).length, 0, status);
});

test("A1: mensagem + contrato + candidatura do mesmo par no mesmo imóvel são UMA conversa; outro imóvel é outra", async () => {
  const l = await lista(U.morador, {
    messages: [mensagem(U.morador, U.dono, U.imovel, "Oi", "2026-11-10T12:00:00Z")],
    contratos: [contrato("ct-1", U.morador, U.imovel), contrato("ct-2", U.morador, U.imovel2)],
    leads: [candidatura("ld-1", U.morador, U.imovel, "accepted")],
  });
  assert.deepEqual(l.map((c) => c.id).sort(), [conv(U.morador, U.dono, U.imovel), conv(U.morador, U.outro, U.imovel2)].sort());
  assert.equal(l.find((c) => c.id === conv(U.morador, U.dono, U.imovel))!.messages.length, 1);
});

test("A1: contrato e candidatura de outras pessoas nunca viram conversa minha; a conversa pedida de fora não abre", async () => {
  const deOutros = { contratos: [contrato("ct-9", U.outro, U.imovel)], leads: [candidatura("ld-9", U.outro, U.imovel, "new")] };
  const minha = await lista(U.morador, { ...deOutros, messages: [mensagem(U.morador, U.dono, U.imovel, "Oi", "2026-11-10T12:00:00Z")] });
  const ids = minha.map((c) => c.id);
  assert.deepEqual(ids, [conv(U.morador, U.dono, U.imovel)]);
  const pedida = conv(U.outro, U.dono, U.imovel); // a conversa do outro morador com o dono
  assert.equal(conversaInicial(pedida, ids), null, "nunca abre a 1ª da lista no lugar da pedida");
  assert.equal(conversaInicial(ids[0], ids), ids[0]);
});
