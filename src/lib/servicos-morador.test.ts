/*
  Serviços para o morador (ordem 521c5af7, telas S1–S3): serviço sem parceiro não aceita pedido, validação do
  pedido (data, faixa, observação), estados e a migração 0174 (RLS: o morador só vê os próprios pedidos).
  Roda: node --experimental-strip-types --test src/lib/servicos-morador.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  FAIXAS_HORARIO,
  NOTA_PAGAMENTO_DIRETO,
  codigoDoPedido,
  rotuloEstado,
  servicoAceitaPedido,
  validarPedido,
} from "./servicos-morador.ts";

const agora = new Date("2026-10-19T12:00:00.000Z");
const comParceiro = { id: "limpeza", status: "ativo", parceiro_nome: "Limpa Bem", preco_texto: "R$ 120 por visita" };

test("serviço sem parceiro ou 'em breve' não aceita pedido", () => {
  assert.equal(servicoAceitaPedido(comParceiro), true);
  assert.equal(servicoAceitaPedido({ ...comParceiro, parceiro_nome: null }), false);
  assert.equal(servicoAceitaPedido({ ...comParceiro, parceiro_nome: "   " }), false);
  assert.equal(servicoAceitaPedido({ ...comParceiro, status: "em_breve" }), false);
  assert.equal(servicoAceitaPedido({ ...comParceiro, status: "inativo" }), false);
});

test("pedido: data a partir de amanhã, faixa conhecida, observação até 300", () => {
  const ok = validarPedido({ data: "2026-10-21", faixa: "manha", observacao: "  Portão azul  " }, agora);
  assert.ok(ok.ok);
  assert.equal(ok.pedido.observacao, "Portão azul");
  assert.equal(ok.pedido.faixa, "manha");
  assert.deepEqual(FAIXAS_HORARIO.map((f) => f.id), ["manha", "tarde", "noite"]);
  assert.equal(validarPedido({ data: "2026-10-19", faixa: "manha" }, agora).ok, false, "hoje (Brasília) já passou da hora de pedir");
  assert.equal(validarPedido({ data: "2026-02-30", faixa: "manha" }, agora).ok, false, "data inexistente");
  assert.equal(validarPedido({ data: "21/10/2026", faixa: "manha" }, agora).ok, false);
  assert.equal(validarPedido({ data: "2026-10-21", faixa: "madrugada" }, agora).ok, false);
  assert.equal(validarPedido({ data: "2027-10-21", faixa: "tarde" }, agora).ok, false, "mais de 90 dias");
  assert.equal(validarPedido({ data: "2026-10-21", faixa: "tarde", observacao: "x".repeat(301) }, agora).ok, false);
  assert.equal(validarPedido(null, agora).ok, false);
  const vazio = validarPedido({ data: "2026-10-21", faixa: "noite", observacao: "" }, agora);
  assert.ok(vazio.ok);
  assert.equal(vazio.pedido.observacao, null);
});

test("estados, código do pedido e nota de pagamento direto", () => {
  assert.equal(rotuloEstado("enviado"), "Pedido enviado");
  assert.equal(rotuloEstado("confirmado"), "Confirmado");
  assert.equal(rotuloEstado("feito"), "Feito");
  assert.equal(rotuloEstado("qualquer"), "Pedido enviado");
  assert.equal(codigoDoPedido("1234abcd-0000-4000-8000-000000000000"), "SV-1234ABCD");
  assert.match(NOTA_PAGAMENTO_DIRETO, /paga direto ao prestador/);
  assert.match(NOTA_PAGAMENTO_DIRETO, /indica parceiros e acompanha o pedido/);
});

test("migração 0174: RLS ligada, morador só lê os próprios pedidos, sem escrita direta", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/0174_servicos_pedidos.sql", import.meta.url), "utf8");
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on public\.servicos_pedidos from anon, authenticated/i);
  assert.match(sql, /tenant_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /is_admin\(\)/);
  assert.doesNotMatch(sql, /grant (insert|update|delete)[^;]*to authenticated/i);
  const prod = readFileSync(new URL("../../supabase/producao/aplicar-0174.sql", import.meta.url), "utf8");
  assert.match(prod, /^begin;/m);
  assert.match(prod, /commit;/);
  assert.match(prod, /schema_migrations/);
  assert.match(prod, /0174_servicos_pedidos/);
});
