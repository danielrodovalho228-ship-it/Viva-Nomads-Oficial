import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  estaAberto,
  linkValido,
  proximosStatus,
  ROTULO_STATUS,
  STATUS_AJUDA,
  transicaoValida,
  validarPedidoAjuda,
} from "./ajuda.ts";

test("pedido precisa de link ou texto; link só https/http e sem senha na URL", () => {
  assert.equal(validarPedidoAjuda({}).ok, false);
  assert.equal(validarPedidoAjuda({ link: "javascript:alert(1)" }).ok, false);
  assert.equal(validarPedidoAjuda({ link: "https://user:senha@site.com/a" }).ok, false);
  const ok = validarPedidoAjuda({ link: " https://site.com/anuncio/1 ", observacao: " fotos no link " });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.valor.link, "https://site.com/anuncio/1");
    assert.equal(ok.valor.texto, null);
    assert.equal(ok.valor.observacao, "fotos no link");
  }
  assert.ok(validarPedidoAjuda({ texto: "Apartamento mobiliado, 2 quartos, perto da UFU." }).ok);
  assert.equal(validarPedidoAjuda({ texto: "curto" }).ok, false);
  assert.equal(validarPedidoAjuda({ texto: "a".repeat(6001) }).ok, false);
  assert.equal(linkValido("não é link"), null);
});

test("fila: recebido → em montagem → enviado ao dono; não volta nem pula", () => {
  assert.deepEqual(proximosStatus("recebido"), ["em_montagem", "cancelado"]);
  assert.ok(transicaoValida("em_montagem", "enviado_dono"));
  assert.equal(transicaoValida("recebido", "enviado_dono"), false);
  assert.equal(transicaoValida("enviado_dono", "recebido"), false);
  assert.equal(transicaoValida("cancelado", "em_montagem"), false);
  assert.ok(estaAberto("recebido") && estaAberto("em_montagem"));
  assert.ok(!estaAberto("enviado_dono") && !estaAberto("cancelado"));
  for (const s of STATUS_AJUDA) assert.ok(ROTULO_STATUS[s]);
});

test("migração 0155: RLS ligada, anon sem acesso, dono só cria 'recebido', só admin atualiza", () => {
  const sql = readFileSync("supabase/migrations/0155_ajuda_publicacao.sql", "utf8");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.pedidos_ajuda_publicacao from anon/);
  assert.match(sql, /with check \(owner_id = \(select auth\.uid\(\)\) and status = 'recebido'\)/);
  assert.match(sql, /for update to authenticated\s+using \(public\.is_admin\(\)\)/);
  const aplicar = readFileSync("supabase/producao/aplicar-0155.sql", "utf8");
  assert.match(aplicar, /^begin;/m);
  assert.match(aplicar, /schema_migrations/);
  assert.match(aplicar, /commit;\s*$/);
  assert.match(readFileSync("supabase/producao/rollback/0155_rollback.sql", "utf8"), /drop table if exists public\.pedidos_ajuda_publicacao/);
});
