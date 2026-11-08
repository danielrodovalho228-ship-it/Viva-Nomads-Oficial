/* Roda: node --test tests/migracoes/parceiro-avaliacoes-0323.test.ts — E679-B parte 2 (avaliação do parceiro igual à da estadia). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CRITERIOS } from "../../src/lib/avaliacoes-criterios.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const sem = (s: string) => s.replace(/--[^\n]*/g, "");
const mig = sem(ler("supabase/migrations/0323_parceiro_avaliacoes_e679.sql"));
const apl = sem(ler("supabase/producao/aplicar-0323.sql"));
const rb = ler("supabase/producao/rollback/0323_rollback.sql");

test("as chaves de critério do banco são as do TypeScript, nos dois papéis", () => {
  const ts = (par: keyof typeof CRITERIOS) => CRITERIOS[par].map((c) => `'${c.chave}'`).join(", ");
  for (const s of [mig, apl]) {
    assert.ok(s.includes(`array[${ts("cliente_avalia_parceiro")}]`));
    assert.ok(s.includes(`array[${ts("parceiro_avalia_cliente")}]`));
  }
});

test("janela de 14 dias da conclusão, três critérios, recomendaria, sem edição depois de enviada", () => {
  for (const s of [mig, apl]) {
    assert.match(s, /now\(\) > x\.concluido_em \+ interval '14 days'/);
    assert.match(s, /<> 3 then\s+raise exception/);
    assert.match(s, /new\.recomendaria is null/);
    assert.match(s, /Avaliação enviada não pode ser alterada/);
    assert.match(s, /contem_documento\(new\.texto\)/);
  }
});

test("mesmo motor de publicação: só publicadas do cliente contam na nota_media, inclusive na remoção", () => {
  for (const s of [mig, apl]) {
    assert.equal((s.match(/create or replace function public\.publicar_avaliacoes_parceiro/g) ?? []).length, 1);
    assert.match(s, /a\.status = 'publicada' and a\.papel_autor = 'cliente'/);
    assert.doesNotMatch(s, /create (or replace )?function public\.publicar_avaliacoes_parceiro_/);
  }
});

test("nota parceiro → cliente: só outros parceiros leem (RLS e RPC), o cliente avaliado não; notas privadas não saem", () => {
  for (const s of [mig, apl]) {
    assert.match(s, /else public\.sou_parceiro\(\)\s+and not exists \(select 1 from public\.parceiro_pedidos x where x\.id = p_pedido and x\.cliente_id = \(select auth\.uid\(\)\)\)/);
    assert.match(s, /parceiro_avaliacao_legivel\(pedido_id, papel_autor\)/);
    assert.match(s, /revoke select on public\.parceiro_avaliacoes from authenticated;/);
    assert.doesNotMatch(s.match(/grant select \(id, pedido_id[^)]*\)/)?.[0] ?? "", /nota_privada/);
    assert.match(s, /nota_do_cliente_entre_parceiros[\s\S]*public\.sou_parceiro\(\) and \(select auth\.uid\(\)\) <> p_cliente/);
    assert.doesNotMatch(s, /to anon[^;]*parceiro_avaliacoes/);
  }
});

test("resposta e revisão: mesma trilha, só a avaliação do cliente sobre o parceiro, uma resposta por avaliação", () => {
  for (const s of [mig, apl]) {
    assert.match(s, /avaliacao_respostas add column if not exists parceiro_avaliacao_id/);
    assert.match(s, /avaliacao_contestacoes add column if not exists parceiro_avaliacao_id/);
    assert.match(s, /\(avaliacao_id is null\) <> \(parceiro_avaliacao_id is null\)/);
    assert.match(s, /unique index if not exists avaliacao_respostas_uma_por_parceiro/);
    assert.match(s, /pa\.papel_autor = 'cliente'/);
  }
});

test("sem dados nem chaves; aplicar registra; rollback desfaz", () => {
  for (const s of [mig, apl]) assert.doesNotMatch(s, /\btruncate|AUTOMACOES_ATIVO|ORDEM_NOVA_ATIVA|ranking_sinais|VN-CT-D5D50247/i);
  assert.match(apl, /begin;[\s\S]*20261107000323[\s\S]*commit;/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261107000323'/);
  assert.match(rb, /drop function if exists public\.sou_parceiro\(\)/);
});
