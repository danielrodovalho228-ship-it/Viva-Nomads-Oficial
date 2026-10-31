/* Roda: node --test tests/migracoes/qa-massa-automacoes-0268.test.ts — 0268: massa da prova do E289 (grupo 1). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avisarRenovacao, lembreteDeSaida, pedirAvaliacao } from "../../src/lib/automacoes/regras.ts";
import { LEMBRETE_DONO_DIAS } from "../../src/lib/estadia/instrucoes.ts";

const mig = readFileSync("supabase/migrations/0268_qa_massa_automacoes_e289.sql", "utf8");
const apl = readFileSync("supabase/producao/aplicar-0268.sql", "utf8");
const rb = readFileSync("supabase/producao/rollback/0268_rollback.sql", "utf8");
const sql = (s: string) => s.replace(/--[^\n]*/g, "");
const corpo = (s: string) => sql(s.slice(s.indexOf("do $$"), s.lastIndexOf("$$;")));

test("0268: só contas de teste e ids fixos; idempotente; nada de AUTOMACOES_ATIVO, seed do D-5 ou a Ana", () => {
  const s = corpo(mig);
  assert.match(s, /lower\(email\) = 'proprietario1@vivanomads\.com\.br' and is_teste/);
  assert.match(s, /lower\(email\) = 'cadastro1@vivanomads\.com\.br' and is_teste/);
  assert.match(s, /if exists \(select 1 from public\.properties where id in \(c_imovel_s, c_imovel_a, c_imovel_r\)\) then/);
  assert.doesNotMatch(s, /update public\.profiles|d5d50247|3555816b|AUTOMACOES_ATIVO/);
  assert.doesNotMatch(s, /\bdelete from\b|\bupdate public\.(profiles|contratos|properties)\b/);
  for (const t of ["[TESTE QA] Automações E289 S", "[TESTE QA] Automações E289 A", "[TESTE QA] Automações E289 R"]) assert.ok(s.includes(`'${t}'`), t);
  assert.equal((s.match(/'paused'/g) ?? []).length, 3);
  // Os 6 primeiros caracteres dos ids dos anúncios diferem (código público único — E275).
  const ids = [...s.matchAll(/c_imovel_[sar] constant uuid := '([0-9a-f-]+)'/g)].map((m) => m[1].slice(0, 6));
  assert.equal(new Set(ids).size, 3);
  // O aplicar é o mesmo corpo, entre begin/commit e registrado.
  assert.equal(corpo(apl), corpo(mig));
  assert.match(apl, /^-- [^\n]*\nbegin;/);
  assert.match(apl, /'20261031000268', '0268_qa_massa_automacoes_e289'[\s\S]*where not exists[\s\S]*commit;\s*$/);
});

test("0268: as datas caem no dia exato de cada regra do cron, contadas do dia ALVO", () => {
  const s = corpo(mig);
  assert.match(s, /v_alvo := v_agora::date \+ case when v_agora::time >= time '09:30' then 1 else 0 end;/);
  // ALVO fictício: confere as regras do cron com os deslocamentos da massa.
  const alvo = "2026-11-02";
  const d = (n: number) => new Date(Date.parse(`${alvo}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  assert.match(s, /\(c_contrato_s, 1, v_alvo - 27, v_alvo \+ 3,/);
  assert.ok(lembreteDeSaida(d(3), alvo));
  assert.match(s, /\(c_contrato_a, 1, v_alvo - 31, v_alvo - 1,/);
  assert.ok(pedirAvaliacao(d(-1), alvo));
  assert.match(s, /\(c_contrato_r, 1, v_alvo - 14, v_alvo \+ 15, 1, 3200, 3200, 'avista', 'pendente', 'ativo'\)/);
  assert.ok(avisarRenovacao(d(15), alvo));
  assert.match(s, /\(c_contrato_i, 1, v_alvo \+ 10, v_alvo \+ 40,[^\n]*'agendado'\)/);
  assert.equal(LEMBRETE_DONO_DIAS, 10);
  // A proposta: última versão da moradora (a vez é do dono), vence no dia ALVO às 22:00 de Brasília.
  assert.match(s, /'enviada', 1, 3, \(v_alvo \+ time '22:00'\) at time zone 'America\/Sao_Paulo'\)/);
  assert.match(s, /values \(c_proposta, 1, 'tenant',/);
  assert.match(s, /next_document_number\('orcamento'::public\.doc_type/);
  // Nenhum período de contrato ativo se sobrepõe no mesmo anúncio (exclusão contratos_periodo_sem_sobreposicao).
  assert.match(s, /daterange\(v_alvo - 31, v_alvo, '\[\)'\)/);
  assert.match(s, /daterange\(v_alvo \+ 10, v_alvo \+ 41, '\[\)'\)/);
});

test("0268: o rollback tira só a massa (ids fixos) e o registro", () => {
  const s = sql(rb);
  assert.match(s, /delete from public\.properties where id = any \(c_imoveis\);/);
  assert.match(s, /delete from public\.contratos where id = any \(c_contratos\);/);
  assert.match(s, /delete from public\.propostas where id = c_proposta;/);
  assert.match(s, /delete from public\.leads where id = 'a0268c00-0000-4000-8000-000000000031';/);
  assert.doesNotMatch(s, /delete from public\.(profiles|emails_teste)/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261031000268';/);
  assert.match(readFileSync("docs/qa-prova-e289-cron.md", "utf8"), /0268_qa_massa_automacoes_e289/);
});
