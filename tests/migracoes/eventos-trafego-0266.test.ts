/* Roda: node --test tests/migracoes/eventos-trafego-0266.test.ts — 0266 (E288-B): coluna trafego e contagem só do real. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mig = readFileSync("supabase/migrations/0266_eventos_trafego.sql", "utf8");
const apl = readFileSync("supabase/producao/aplicar-0266.sql", "utf8");
const rb = readFileSync("supabase/producao/rollback/0266_rollback.sql", "utf8");
const m0181 = readFileSync("supabase/migrations/0181_admin_conversa_com_tudo.sql", "utf8");
const sql = (s: string) => s.replace(/--[^\n]*/g, "");

test("0266: coluna trafego (real|e2e|teste, padrão real), idempotente; só eventos de conta is_teste viram 'teste'", () => {
  for (const s of [sql(mig), sql(apl)]) {
    assert.match(s, /alter table public\.eventos add column if not exists trafego text not null default 'real';/);
    assert.match(s, /check \(trafego in \('real', 'e2e', 'teste'\)\)/);
    assert.match(s, /update public\.eventos e\s+set trafego = 'teste'\s+from public\.profiles p\s+where p\.id = e\.usuario_id\s+and p\.is_teste is true\s+and e\.trafego = 'real';/);
    assert.equal((s.match(/update /g) ?? []).length, 1);
    assert.doesNotMatch(s, /delete from public|drop table/);
  }
});

test("0266: as funções do admin contam só 'real' e informam quantos ficaram fora; o resto do corpo é o da 0181", () => {
  const s = sql(mig);
  assert.match(s, /and \(e\.usuario_id is null or not public\.admin_eh_teste\(e\.usuario_id\)\)\s+and e\.trafego = 'real'\s+\),\s+eventos_fora as/);
  assert.match(s, /'eventos_teste_fora', \(select n from eventos_fora\),/);
  assert.equal((s.match(/and e\.trafego = 'real' and \(e\.usuario_id is null or not public\.admin_eh_teste\(e\.usuario_id\)\)/g) ?? []).length, 2);
  // Sem as mudanças do E288-B, cada função é igual à da 0181 (que é a de produção).
  const corpo = (txt: string, nome: string) => {
    const i = txt.indexOf(`create or replace function public.${nome}`);
    const a = txt.indexOf("$$", i) + 2;
    return txt.slice(a, txt.indexOf("$$", a));
  };
  const semE288 = (t: string) =>
    t
      .replace(/\n\s+and e\.trafego = 'real'\n  \),\n  eventos_fora as \([\s\S]*?\n  \),/, "\n  ),")
      .replace(/\n\s+-- E288-B[^\n]*\n\s+'eventos_teste_fora', \(select n from eventos_fora\),/, "")
      .replace(/\n\s+and e\.trafego = 'real' and \(e\.usuario_id is null or not public\.admin_eh_teste\(e\.usuario_id\)\)/g, "");
  for (const nome of ["admin_metricas_periodo", "admin_visao_geral"]) {
    assert.equal(semE288(corpo(mig, nome)), corpo(m0181, nome), nome);
    assert.equal(corpo(rb, nome), corpo(m0181, nome), `rollback ${nome}`);
  }
  // Permissões da 0195: só o cliente de serviço.
  assert.match(s, /revoke all on function public\.admin_visao_geral\(date, date, text\) from public, anon, authenticated;/);
  assert.doesNotMatch(s, /to authenticated/);
});

test("0266: aplicar entre begin/commit, registrado com o nome; rollback devolve as funções e tira a coluna", () => {
  assert.match(apl, /^-- [^\n]*\n[^\n]*\nbegin;/);
  assert.match(apl, /commit;\s*$/);
  assert.match(apl, /'20261030000266', '0266_eventos_trafego'[\s\S]*where not exists/);
  assert.match(rb, /alter table public\.eventos drop column if exists trafego;/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261030000266';/);
});
