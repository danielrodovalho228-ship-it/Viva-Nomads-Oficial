import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  donoPodeDecidir,
  ehDecisaoDono,
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

test("dono decide só sobre rascunho enviado: aprova ou pede ajustes; equipe não decide por ele", () => {
  assert.ok(donoPodeDecidir("enviado_dono"));
  for (const s of ["recebido", "em_montagem", "aprovado_dono", "ajustes_pedidos", "cancelado"] as const) {
    assert.equal(donoPodeDecidir(s), false, s);
  }
  assert.ok(ehDecisaoDono("aprovado_dono") && ehDecisaoDono("ajustes_pedidos"));
  assert.equal(ehDecisaoDono("enviado_dono"), false);
  assert.equal(ehDecisaoDono("cancelado"), false);
  // a equipe não pula a aprovação do dono
  assert.equal(transicaoValida("enviado_dono", "aprovado_dono"), false);
  assert.equal(transicaoValida("em_montagem", "aprovado_dono"), false);
  // ajustes pedidos voltam para a montagem e contam como pedido aberto
  assert.ok(transicaoValida("ajustes_pedidos", "em_montagem"));
  assert.ok(estaAberto("ajustes_pedidos"));
  assert.ok(!estaAberto("aprovado_dono"));
  for (const s of STATUS_AJUDA) assert.ok(ROTULO_STATUS[s]);
});

test("migração 0156: dono só decide pedido seu 'enviado_dono' e só vincula imóvel dele; rollback e registro", () => {
  const sql = readFileSync("supabase/migrations/0156_ajuda_publicacao_decisao_dono.sql", "utf8");
  assert.match(sql, /using \(owner_id = \(select auth\.uid\(\)\) and status = 'enviado_dono'\)/);
  assert.match(sql, /status in \('aprovado_dono', 'ajustes_pedidos'\)/);
  assert.match(sql, /p\.owner_id = \(select auth\.uid\(\)\)/);
  const aplicar = readFileSync("supabase/producao/aplicar-0156.sql", "utf8");
  assert.match(aplicar, /^begin;/m);
  assert.match(aplicar, /20261018000156/);
  assert.match(aplicar, /commit;\s*$/);
  assert.match(readFileSync("supabase/producao/rollback/0156_rollback.sql", "utf8"), /drop policy if exists ajuda_publicacao_dono_decide/);
});

test("ação decidirRascunhoAjuda exige dono, status enviado_dono e não confia no cliente", () => {
  const src = readFileSync("src/lib/data/ajuda-publicacao-actions.ts", "utf8");
  const corpo = src.slice(src.indexOf("export async function decidirRascunhoAjuda"));
  assert.match(corpo, /ehDecisaoDono\(decisao\)/);
  assert.match(corpo, /\.eq\("owner_id", user\.id\)/);
  assert.match(corpo, /\.eq\("status", "enviado_dono"\)/);
});

test("botões do rascunho somem na hora e a lista recarrega após a decisão do dono (t191)", () => {
  const src = readFileSync("src/components/property/decisao-rascunho.tsx", "utf8");
  assert.match(src, /setDecidido\(true\)/);
  assert.match(src, /router\.refresh\(\)/);
  assert.match(src, /if \(decidido\) return null/);
});
