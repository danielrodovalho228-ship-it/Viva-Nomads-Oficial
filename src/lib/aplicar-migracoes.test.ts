/*
  "Merge aplica migração": a Action, o script e o padrão dos aplicar-NNNN.sql.
  Roda: node --test src/lib/aplicar-migracoes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const raiz = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("Action: só na main (ou à mão), um por vez, segredo nunca impresso, forks não aplicam", () => {
  const wf = raiz(".github/workflows/aplicar-migracoes.yml");
  assert.match(wf, /push:\n\s+branches: \[main\]\n\s+paths:\n\s+- "supabase\/producao\/aplicar-\*\.sql"/);
  assert.match(wf, /workflow_dispatch:/);
  assert.doesNotMatch(wf, /pull_request/); // PR nunca aplica nada
  assert.match(wf, /permissions:\n\s+contents: read/);
  assert.match(wf, /cancel-in-progress: false/);
  assert.match(wf, /if: github\.repository == 'danielrodovalho228-ship-it\/Viva-Nomads-Oficial'/);
  assert.match(wf, /SUPABASE_DB_URL: \$\{\{ secrets\.SUPABASE_DB_URL \}\}/);
  assert.doesNotMatch(wf, /echo[^\n]*\$SUPABASE_DB_URL/);
});

test("script: valida tudo antes, pula o registrado, descarta saída, erro sem DETAIL, nunca rollback", () => {
  const sh = raiz("scripts/aplicar-migracoes.sh");
  assert.match(sh, /set -euo pipefail/);
  assert.match(sh, /grep -E '\^aplicar-\[0-9\]\{4\}\\\.sql\$'/);
  assert.match(sh, /MINIMA=76/);
  assert.match(sh, /name ~ '\^\[0-9\]\{4\}_'/);
  assert.ok(sh.indexOf("# 1) Descobre e VALIDA") < sh.indexOf("# 2) Aplica em ordem"));
  assert.match(sh, /psqlq -o \/dev\/null -f "\$caminho" >\/dev\/null 2>"\$erro_arq"/);
  assert.match(sh, /grep -m1 -E 'ERROR:'/);
  assert.doesNotMatch(sh, /rollback\//);
  assert.doesNotMatch(sh, /echo[^\n]*SUPABASE_DB_URL\b(?!:)/);
});

test("todo aplicar-NNNN.sql a partir da 0076: begin/commit e registro 'NNNN_…' (inclusive 0089 e 0091)", () => {
  const arquivos = readdirSync(new URL("../../supabase/producao/", import.meta.url)).filter((f) => /^aplicar-\d{4}\.sql$/.test(f));
  const novos = arquivos.filter((f) => Number(f.slice(8, 12)) >= 76);
  assert.ok(novos.includes("aplicar-0089.sql") && novos.includes("aplicar-0091.sql"));
  for (const f of novos) {
    const sql = raiz(`supabase/producao/${f}`);
    const n = f.slice(8, 12);
    assert.match(sql, /^begin;$/m, f);
    assert.match(sql, /^commit;$/m, f);
    assert.match(sql, /insert into supabase_migrations\.schema_migrations/, f);
    assert.match(sql, new RegExp(`'${n}_[a-z0-9_]+'`), f);
    // Registro idempotente: "where not exists (…)" ou "on conflict (version) do nothing".
    assert.match(sql, /where not exists \(select 1 from supabase_migrations\.schema_migrations|on conflict \(version\) do nothing/, f);
  }
});
