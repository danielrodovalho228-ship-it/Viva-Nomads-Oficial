/*
  E541 (GRAVE) — "Responder pela plataforma" (Interesses do proprietário) abria a conversa da pessoa errada.
  Causa: o botão levava a /dashboard/mensagens SEM dizer qual conversa; a caixa abre a primeira da lista (a mais
  recente — quase sempre de outra pessoa). Correção: cada candidatura traz o id da conversa (mesma regra do servidor:
  as duas pessoas ordenadas + o imóvel) e o botão abre /dashboard/mensagens?conversa=<id>. A caixa já trata o parâmetro e,
  se a conversa não estiver na lista, avisa — nunca abre a de outra pessoa.
  Roda: node --test src/lib/data/e541-responder-conversa.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { conversationId } from "../messages/conversation-id.ts";
import { conversaInicial } from "../mensagens/conversa-pedida.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("o id da conversa do dono com o candidato é o mesmo do lado do candidato (e muda com o imóvel)", () => {
  const dono = "aaaaaaaa-0000-4000-8000-000000000001";
  const morador = "bbbbbbbb-0000-4000-8000-000000000002";
  const imovel = "cccccccc-0000-4000-8000-000000000003";
  assert.equal(conversationId(morador, dono, imovel), conversationId(dono, morador, imovel));
  assert.notEqual(conversationId(morador, dono, imovel), conversationId(morador, dono, "dddddddd-0000-4000-8000-000000000004"));
});

test("a caixa abre a conversa pedida; se ela não estiver na lista, nenhuma outra no lugar", () => {
  assert.equal(conversaInicial("c2", ["c1", "c2"]), "c2");
  assert.equal(conversaInicial("c9", ["c1", "c2"]), null);
});

test("Interesses: cada candidatura traz a conversa e o botão abre exatamente ela", () => {
  const dados = ler("src/lib/data/leads.ts");
  assert.match(dados, /conversaId: conversationId\(r\.tenant_id, user\.id, r\.property_id\)/);
  assert.match(ler("src/lib/data/lead-types.ts"), /conversaId\?: string;/);
  const tela = ler("src/app/(dashboard)/dashboard/leads/leads-client.tsx");
  assert.match(tela, /href=\{hrefResponder\(l\)\}/);
  assert.match(tela, /`\/dashboard\/mensagens\?conversa=\$\{l\.conversaId\}`/);
  assert.doesNotMatch(tela, /<ButtonLink href="\/dashboard\/mensagens" variant="secondary" size="sm">\s*<MessageSquare className="h-4 w-4" \/> Responder pela plataforma/);
});
