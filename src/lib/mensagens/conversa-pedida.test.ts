/*
  E200 — "Mensagem" nunca cai na conversa de outro morador.
  Roda: node --test src/lib/mensagens/conversa-pedida.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { conversaInicial, resolverConversaPedida, type ContratoParaConversa } from "./conversa-pedida.ts";
import { conversationId } from "../messages/conversation-id.ts";

const DONO = "7216d0e9-6246-482a-a1de-524fd5231dc2";
const INQ = "3555816b-7100-4301-94a4-aec9eeccf991";
const OUTRO = "11111111-1111-4111-8111-111111111111";
const IMOVEL = "330ebf37-fca4-4f8a-88d9-47614bc56674";
const contrato: ContratoParaConversa = { id: "d5d50247-0000-4000-8000-00000000c001", tenantId: INQ, ownerId: DONO, propertyId: IMOVEL, titulo: "Premium" };
const pedida = conversationId(INQ, DONO, IMOVEL);
const ler = (rel: string) => readFileSync(new URL(`../../../${rel}`, import.meta.url), "utf8");

test("o id do botão é o mesmo do QA (cc657f1c…) e é a conversa do contrato", () => {
  assert.equal(pedida, "cc657f1c-49ad-5b98-8d5c-fd35f33f04f3");
});

test("contrato sem mensagens: abre a conversa do contrato vazia, com a outra parte certa", () => {
  const r = resolverConversaPedida(pedida, ["conversa-de-outro-morador"], [contrato], DONO, conversationId);
  assert.equal(r.tipo, "nova");
  if (r.tipo === "nova") {
    assert.equal(r.outroId, INQ);
    assert.equal(r.papel, "proprietario");
  }
  const m = resolverConversaPedida(pedida, [], [contrato], INQ, conversationId);
  assert.ok(m.tipo === "nova" && m.outroId === DONO && m.papel === "inquilino");
});

test("conversa que a pessoa não tem e não é de contrato dela: não encontrada", () => {
  assert.equal(resolverConversaPedida(pedida, ["x"], [contrato], OUTRO, conversationId).tipo, "nao_encontrada");
  assert.equal(resolverConversaPedida("ffffffff-ffff-4fff-8fff-ffffffffffff", ["x"], [contrato], DONO, conversationId).tipo, "nao_encontrada");
  assert.equal(resolverConversaPedida(pedida, [pedida], [], DONO, conversationId).tipo, "existe");
  assert.equal(resolverConversaPedida(undefined, ["x"], [], DONO, conversationId).tipo, "nenhuma");
});

test("ao carregar: conversa pedida e fora da lista não abre nenhuma (nunca a 1ª da lista)", () => {
  assert.equal(conversaInicial("pedida", ["a", "b"]), null);
  assert.equal(conversaInicial("b", ["a", "b"]), "b");
  assert.equal(conversaInicial(null, ["a", "b"]), "a");
  assert.equal(conversaInicial(undefined, []), null);
});

test("tela e página usam a regra (sem cair em initial[0] quando a conversa pedida não existe)", () => {
  const cliente = ler("src/app/(dashboard)/dashboard/mensagens/messages-client.tsx");
  assert.doesNotMatch(cliente, /existe \? pedida : initial\[0\]\?\.id/);
  assert.match(cliente, /conversaInicial\(/);
  assert.match(cliente, /data-testid="mensagens-conversa-nao-encontrada"/);
  const pagina = ler("src/app/(dashboard)/dashboard/mensagens/page.tsx");
  assert.match(pagina, /resolverConversaPedida\(/);
});
