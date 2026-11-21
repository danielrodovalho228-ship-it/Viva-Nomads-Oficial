/*
  t2023 · E445 (Pista 3, lote 2, item B3 — parte do servidor) @E445 @ao-vivo-seguro
  Regra: falha no meio do envio do anexo devolve um erro visível (mensagem própria, status de erro) e NADA fica órfão:
    • a conversa não aceita a mensagem (RLS) → 403, nenhum arquivo sobe;
    • o arquivo não sobe → 500 "Não foi possível salvar o anexo agora." e a mensagem é apagada;
    • o registro do anexo falha → 500 "Não foi possível registrar o anexo agora.", o arquivo é removido e a mensagem apagada;
  e um novo envio depois da falha passa limpo (uma mensagem, um arquivo, um registro — sem duplicar).
  A parte da TELA (erro na prévia e "tentar de novo") precisa de sessão: fica para o laboratório (ver o PR).
  Roda o POST REAL de src/app/api/mensagens/anexo/route.ts (dublês só nas bordas, ver conversa-harness/).
  Roda: node --test src/lib/messages/e445-t2023-falha-no-envio-do-anexo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { U, novoMundo } from "./conversa-harness/supabase-falso.ts";

const { POST } = await import("../../app/api/mensagens/anexo/route.ts");
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

function pedido() {
  const form = new FormData();
  form.set("receiverId", U.dono);
  form.set("propertyId", U.imovel);
  form.set("file", new File([PDF], "laudo.pdf", { type: "application/pdf" }));
  return new Request("http://teste.invalid/api/mensagens/anexo", { method: "POST", body: form });
}

test("B3: a conversa não aceita a mensagem → 403 com a mensagem, nenhum arquivo sobe", async () => {
  const m = novoMundo({ messages: [], mensagens_anexos: [] }, U.morador);
  m.registro.falhar.add("insert:messages");
  const r = await POST(pedido());
  assert.equal(r.status, 403);
  assert.equal(((await r.json()) as { error: string }).error, "Não foi possível enviar o anexo nesta conversa.");
  assert.equal(m.registro.arquivos.size, 0);
  assert.equal(m.tabelas.mensagens_anexos.length, 0);
});

test("B3: o arquivo não sobe → 500 com a mensagem e a mensagem da conversa é desfeita", async () => {
  const m = novoMundo({ messages: [], mensagens_anexos: [] }, U.morador);
  m.registro.falhar.add("upload");
  const r = await POST(pedido());
  assert.equal(r.status, 500);
  assert.equal(((await r.json()) as { error: string }).error, "Não foi possível salvar o anexo agora.");
  assert.deepEqual([m.tabelas.messages.length, m.tabelas.mensagens_anexos.length, m.registro.arquivos.size], [0, 0, 0]);
  assert.equal(m.registro.apagados.filter((a) => a.tabela === "messages").length, 1, "a mensagem gravada foi apagada");
});

test("B3: o registro do anexo falha → 500, o arquivo sai do bucket e a mensagem é desfeita", async () => {
  const m = novoMundo({ messages: [], mensagens_anexos: [] }, U.morador);
  m.registro.falhar.add("insert:mensagens_anexos");
  const r = await POST(pedido());
  assert.equal(r.status, 500);
  assert.equal(((await r.json()) as { error: string }).error, "Não foi possível registrar o anexo agora.");
  assert.deepEqual([m.tabelas.messages.length, m.tabelas.mensagens_anexos.length, m.registro.arquivos.size], [0, 0, 0]);
});

test("B3: tentar de novo depois da falha envia uma vez só (sem mensagem nem arquivo duplicado)", async () => {
  const m = novoMundo({ messages: [], mensagens_anexos: [] }, U.morador);
  m.registro.falhar.add("upload");
  assert.equal((await POST(pedido())).status, 500);
  m.registro.falhar.clear();
  const r = await POST(pedido());
  assert.equal(r.status, 200);
  assert.deepEqual([m.tabelas.messages.length, m.tabelas.mensagens_anexos.length, m.registro.arquivos.size], [1, 1, 1]);
  assert.equal(m.tabelas.mensagens_anexos[0].message_id, m.tabelas.messages[0].id);
});
