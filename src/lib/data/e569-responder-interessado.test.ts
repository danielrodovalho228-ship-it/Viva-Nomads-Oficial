/*
  E569 (resíduo do E541): o "Responder pela plataforma" fica visível no cartão do interessado (antes e depois do aceite)
  e abre a conversa DAQUELE morador naquele imóvel; o requisito do dono (documento) aparece antes de qualquer clique.
  Roda: node --test src/lib/data/e569-responder-interessado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");
const cliente = ler("src/app/(dashboard)/dashboard/leads/leads-client.tsx");

test("o botão fica no cartão (só some na recusada) e abre a conversa do morador naquele imóvel", () => {
  assert.match(cliente, /\{st !== "rejected" && \(\n\s*<ButtonLink href=\{hrefResponder\(l\)\}/);
  assert.match(cliente, /data-testid="responder-pela-plataforma"/);
  assert.match(ler("src/lib/data/leads.ts"), /conversaId: conversationId\(r\.tenant_id, user\.id, r\.property_id\)/);
});

test("o 'aprovado' só aparece depois que o servidor confirma (nada de botão que surge e some)", () => {
  const fn = cliente.slice(cliente.indexOf("function aprovar("), cliente.indexOf("function recusar("));
  assert.ok(fn.indexOf('set(id, "approved")', fn.indexOf("aceitarCandidatura(id)")) > 0, "aprovado depois da resposta");
  assert.doesNotMatch(fn.slice(0, fn.indexOf("startTransition")), /set\(id, "approved"\);\n\s*if \(demoOn\) return;/);
});

test("a pendência do dono vem do servidor e aparece antes de qualquer clique, com o caminho", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/leads/page.tsx"), /pendenciaDoDonoParaAceite\(\)/);
  const dados = ler("src/lib/data/leads.ts");
  assert.match(dados, /if \(await temDocumento\(admin, user\.id\)\) return null;/);
  assert.match(dados, /texto: MSG_DOCUMENTO\.aceitar, href: LINK_DOCUMENTO, rotulo: "Informar meu documento"/);
  assert.match(cliente, /data-testid="pendencia-dono-aceite"/);
});

test("Mensagens traz a conversa de cada candidatura em andamento, mesmo sem mensagem", () => {
  const m = ler("src/lib/data/messages.ts");
  assert.match(m, /await candidaturasDaPessoa\(supabase, user\.id\)/);
  assert.match(m, /\.in\("status", \["new", "accepted"\]\)/);
  assert.match(m, /const conversas = \[\.\.\.doContrato, \.\.\.daCandidatura, \.\.\.byConv\.values\(\)\];/);
});
