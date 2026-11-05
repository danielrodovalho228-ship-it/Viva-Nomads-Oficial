/*
  E585 — reteste de 05/11: digitando um e-mail no compositor da conversa, nenhum aviso nem prévia mascarada aparecia
  antes de enviar e o botão Enviar não mudava (o aviso do E445 só abria DEPOIS do clique em Enviar). A proposta mostra a
  mensagem já mascarada antes do envio. Uniformiza: a conversa mostra o aviso e a prévia mascarada AO DIGITAR, o botão
  Enviar muda de cara e o envio com contato só sai pelo gesto "Enviar mesmo assim" (Enter ou o botão redondo nunca
  enviam o contato).
  Roda: node --test src/lib/messages/e585-aviso-ao-digitar.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { previaAoDigitar } from "./aviso-envio.ts";

test("ao digitar: e-mail ou telefone dão a prévia mascarada; texto limpo, vazio ou resposta rápida não", () => {
  assert.equal(previaAoDigitar("meu e-mail é joao@gmail.com"), "meu e-mail é [contato protegido]");
  assert.match(previaAoDigitar("liga (34) 99876-5432") ?? "", /\[contato protegido\]/);
  assert.equal(previaAoDigitar("Posso visitar sábado?"), null);
  assert.equal(previaAoDigitar("   "), null);
  // Resposta rápida com contato é bloqueada (55-E2), não mascarada: ali vale o bloqueio, não a prévia.
  assert.equal(previaAoDigitar("joao@gmail.com", { deRapida: true }), null);
});

test("a conversa mostra o aviso ao digitar, muda o botão e só envia contato pelo 'Enviar mesmo assim'", () => {
  const s = readFileSync(new URL("../../app/(dashboard)/dashboard/mensagens/messages-client.tsx", import.meta.url), "utf8");
  assert.match(s, /const previaContato = previaAoDigitar\(draft, \{ deRapida \}\);/);
  assert.match(s, /const avisoAberto = previaContato !== null && avisoFechadoPara !== draft;/);
  assert.match(s, /\{avisoAberto && \(/);
  assert.match(s, /data-contato=\{previaContato \? "1" : undefined\}/);
  // O submit com contato reabre o aviso e NÃO envia; só o botão do aviso envia a versão mascarada.
  assert.match(s, /if \(aviso\.tipo === "confirmar"\) return setAvisoFechadoPara\(null\);/);
  assert.match(s, /onClick=\{\(\) => previaContato && void enviar\(previaContato, true\)\}/);
  assert.doesNotMatch(s, /setConfirmarEnvio/);
});
