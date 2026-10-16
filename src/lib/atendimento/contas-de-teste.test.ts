import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem 7436a29a item 3: chamados de contas de teste são simulação e não avisam a equipe.
const ler = (p: string) => readFileSync(p, "utf8");

test("0135: is_teste em profiles, só o servidor liga, e o chamado da conta de teste nasce simulacao", () => {
  const m = ler("supabase/migrations/0135_contas_de_teste.sql");
  assert.match(m, /add column if not exists is_teste boolean not null default false/);
  assert.match(m, /coalesce\(auth\.role\(\), 'service_role'\) in \('authenticated', 'anon'\)/);
  assert.match(m, /new\.is_teste := old\.is_teste/);
  assert.match(m, /before insert on public\.chamados/);
  assert.match(m, /new\.simulacao := true/);
  for (const conta of ["proprietario1", "inquilino1", "teste-qa", "@lab.vivanomads.test"]) assert.ok(m.includes(conta), conta);
  assert.equal((m.match(/set search_path = public/g) ?? []).length, 2);
});

test("aplicar-0135 é idempotente, em transação e se registra; rollback desfaz", () => {
  const a = ler("supabase/producao/aplicar-0135.sql");
  assert.match(a, /^begin;/m);
  assert.match(a, /commit;\s*$/);
  assert.match(a, /add column if not exists is_teste/);
  assert.match(a, /drop trigger if exists chamados_conta_de_teste_tg/);
  assert.match(a, /20261016000135/);
  assert.match(a, /where not exists \(select 1 from supabase_migrations\.schema_migrations/);
  const r = ler("supabase/producao/rollback/0135_rollback.sql");
  assert.match(r, /drop column if exists is_teste/);
  assert.match(r, /delete from supabase_migrations\.schema_migrations where version = '20261016000135'/);
});

test("avisarEquipe não manda nada (e-mail, push, plantão) de chamado em simulação", () => {
  const s = ler("src/lib/atendimento/servidor.ts");
  const corpo = s.slice(s.indexOf("export async function avisarEquipe"));
  const antesDoLoop = corpo.slice(0, corpo.indexOf("for (const a of admins)"));
  assert.match(antesDoLoop, /from\("chamados"\)[\s\S]*simulacao/);
  assert.match(antesDoLoop, /return;/);
});
