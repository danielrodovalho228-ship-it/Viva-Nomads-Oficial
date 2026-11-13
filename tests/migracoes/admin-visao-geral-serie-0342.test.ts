/*
  Roda: node --test tests/migracoes/admin-visao-geral-serie-0342.test.ts
  Frente 3 (PR #3736, t231 no lab-critico): a série diária de admin_visao_geral fazia 6 subconsultas correlacionadas POR DIA
  do período. Num período longo (o t231 sorteia 40–340 dias) a função passou do statement_timeout (8 s) no CI
  ("[admin] visão geral: canceling statement due to statement timeout") e a tela mostrou "—" em todos os indicadores.
  A definição VIGENTE (a da última migração que cria a função) agrega cada tabela uma vez por dia de Brasília.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const sql = (s: string) => s.replace(/--[^\n]*/g, "");
const corpo = (txt: string) => {
  const i = txt.indexOf("create or replace function public.admin_visao_geral");
  const a = txt.indexOf("$$", i) + 2;
  return txt.slice(a, txt.indexOf("$$", a));
};
const vigente = readdirSync("supabase/migrations")
  .filter((f) => /^\d{4}_.*\.sql$/.test(f) && readFileSync(`supabase/migrations/${f}`, "utf8").includes("create or replace function public.admin_visao_geral"))
  .sort()
  .at(-1)!;

test("a admin_visao_geral vigente não tem subconsulta por dia na série (custo não cresce com dias × linhas)", () => {
  const c = sql(corpo(readFileSync(`supabase/migrations/${vigente}`, "utf8")));
  const serie = c.slice(c.indexOf("'serie'"), c.indexOf("'agora'"));
  assert.ok(serie.length > 0, vigente);
  assert.doesNotMatch(serie, /d \+ interval '1 day'/, `${vigente}: subconsulta correlacionada por dia`);
  assert.match(serie, /group by 1/);
  assert.match(serie, /left join ev on ev\.dia = dd\.dia/);
});

test("0342: aplicar idempotente e registrado; rollback volta exatamente a função da 0266; o resto da função é o da 0266", () => {
  const mig = readFileSync("supabase/migrations/0342_admin_visao_geral_serie_agregada.sql", "utf8");
  const apl = readFileSync("supabase/producao/aplicar-0342.sql", "utf8");
  const rb = readFileSync("supabase/producao/rollback/0342_rollback.sql", "utf8");
  const m0266 = readFileSync("supabase/migrations/0266_eventos_trafego.sql", "utf8");
  assert.match(apl, /^begin;$/m);
  assert.match(apl, /^commit;$/m);
  assert.match(apl, /select '20261112000342', '0342_admin_visao_geral_serie_agregada'\s+where not exists/);
  assert.equal(corpo(apl), corpo(mig), "aplicar = migração");
  assert.equal(corpo(rb), corpo(m0266), "rollback = 0266");
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261112000342';/);
  const fora = (t: string) => t.slice(0, t.indexOf("    -- Série diária")) + t.slice(t.indexOf("    -- Fotografia de AGORA"));
  assert.equal(fora(corpo(mig)), fora(corpo(m0266)), "fora da série, igual à 0266");
  for (const s of [mig, apl]) {
    assert.match(s, /grant execute on function public\.admin_visao_geral\(date, date, text\) to service_role;/);
    assert.match(s, /revoke all on function public\.admin_visao_geral\(date, date, text\) from public, anon, authenticated;/);
    assert.doesNotMatch(sql(s), /drop |delete from public/);
  }
  assert.ok(existsSync("supabase/producao/rollback/0342_rollback.sql"));
});
