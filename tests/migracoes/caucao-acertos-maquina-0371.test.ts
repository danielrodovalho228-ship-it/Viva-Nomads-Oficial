/*
  Roda: node --test tests/migracoes/caucao-acertos-maquina-0371.test.ts
  0371 (E1248, ESPEC-E1248 v11, secções 3.6 e 9-A; ORDEM-DUET 1355): as 14 colunas da máquina da devolução da caução em
  caucao_acertos, as regras com nome e os dois índices da rotina de hora a hora. Só LÊ o texto: o complemento barato. A
  prova que afirma o comportamento é a EXECUTADA (tests/e2e/fixtures/prova-0371.ts, spec t1811).
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const sql = (s: string) => s.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();
const ler = (p: string) => (existsSync(p) ? sql(readFileSync(p, "utf8")) : "");
const MIG = ler("supabase/migrations/0371_caucao_acertos_maquina_e1248.sql");
const APLICAR = ler("supabase/producao/aplicar-0371.sql");
const ROLLBACK = ler("supabase/producao/rollback/0371_rollback.sql");
const COLUNAS = ["aviso_em", "lembrete_em", "confirmacao_via", "contestacao_motivo", "contestado_em", "chamado_id", "central_decisao", "central_decidido_em", "central_decidido_por", "central_motivo", "comprovante_path", "comprovante_pedido_em", "comprovante_anexado_em", "comprovante_lembrete_em"];
const REGRAS = ["caucao_acertos_confirmacao_via_chk", "caucao_acertos_central_decisao_chk", "caucao_acertos_decisao_e_hora_chk", "caucao_acertos_nao_confirmada_motivo_chk", "caucao_acertos_contestacao_motivo_chk", "caucao_acertos_comprovante_path_chk"];
const INDICES = ["caucao_acertos_espera_aviso_idx", "caucao_acertos_comprovante_pendente_idx"];

test("0371: as 14 colunas, idempotentes, sem default e sem tocar em linha nenhuma, na migração e no aplicar", () => {
  for (const [nome, s] of Object.entries({ "migração": MIG, "aplicar-0371": APLICAR })) {
    for (const c of COLUNAS) assert.match(s, new RegExp(`add column if not exists ${c} `), `${nome}: ${c}`);
    for (const r of REGRAS) assert.ok(s.includes(r), `${nome}: a regra ${r}`);
    for (const i of INDICES) assert.match(s, new RegExp(`create index if not exists ${i} on public\\.caucao_acertos`), `${nome}: o índice ${i}`);
    assert.doesNotMatch(s, /\bdefault\b|update public\.caucao_acertos|delete from public\.caucao_acertos|create policy|drop policy|grant /i, `${nome}: sem default, sem mexer nas linhas nem no acesso`);
  }
});
test("aplicar-0371: transação curta e registo com o nome", () => {
  assert.match(APLICAR, /^begin; set local lock_timeout = '5s';[\s\S]*commit;$/);
  assert.match(APLICAR, /insert into supabase_migrations\.schema_migrations \(version, name\) select '20261128000371', '0371_caucao_acertos_maquina_e1248' where not exists/);
});
test("rollback da 0371: com dados nas colunas novas levanta erro antes de mudar; senão tira índices, regras, colunas e o registo", () => {
  assert.match(ROLLBACK, /^begin; set local lock_timeout = '5s';[\s\S]*commit;$/);
  const erro = ROLLBACK.indexOf("raise exception");
  assert.ok(erro > 0, "levanta erro quando há dados");
  for (const i of INDICES) assert.ok(ROLLBACK.indexOf(`drop index if exists public.${i};`) > erro, `tira o índice ${i}, depois da conferência`);
  for (const r of REGRAS) assert.ok(ROLLBACK.indexOf(`drop constraint if exists ${r}`) > erro, `tira a regra ${r}`);
  for (const c of COLUNAS) assert.ok(ROLLBACK.indexOf(`drop column if exists ${c}`) > erro, `tira a coluna ${c}`);
  assert.ok(ROLLBACK.indexOf("delete from supabase_migrations.schema_migrations where version = '20261128000371';") > erro);
});
