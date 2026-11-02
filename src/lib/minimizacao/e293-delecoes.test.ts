/*
  E293 — deleções da auditoria de retenção (aprovadas pelo Daniel em 01/11/2026), na migração 0281.
  A guarda: só o que o relatório (§5 P5 e P6) listou; cada linha que sai vai para o livro; nada de P4, destinos ou item 13.
  Roda: node --test src/lib/minimizacao/e293-delecoes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const mig = ler("supabase/migrations/0281_e293_delecoes_retencao.sql");
const corpo = mig.slice(mig.indexOf("create or replace function"));

test("só as tabelas do relatório saem (P5 e P6); nada mais é apagado", () => {
  const apagadas = [...corpo.matchAll(/delete from public\.(\w+)/g)].map((m) => m[1]).sort();
  assert.deepEqual(apagadas, ["internet_medicoes", "internet_medicoes", "proximidades_cep", "tempos_deslocamento"]);
  const alteradas = [...corpo.matchAll(/update public\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual(alteradas, ["tenant_verifications"]);
  for (const fora of ["property_workspaces", "destinos ", "eventos", "push_envios", "saidas_motivos", "denuncias_anuncio", "ia_chamadas"])
    assert.ok(!new RegExp(`(delete from|update) public\\.${fora.trim()}\\b`).test(corpo), fora);
});

test("os critérios são os do relatório: morador processado, dono só a última válida, 30 dias, Mapbox, CAF vencida", () => {
  assert.match(corpo, /where papel = 'morador' and medido_em < now\(\) - interval '1 day'/);
  assert.match(corpo, /where papel = 'dono' and validada/);
  assert.match(corpo, /m\.papel = 'dono' and m\.property_id = u\.property_id and coalesce\(m\.ponto, ''\) = u\.ponto and m\.medido_em < u\.em/);
  assert.match(corpo, /delete from public\.tempos_deslocamento where calculado_em < now\(\) - interval '30 days'/);
  assert.match(corpo, /delete from public\.proximidades_cep where atualizado_em < now\(\) - interval '30 days' or fonte = 'mapbox'/);
  assert.match(corpo, /where valid_until < now\(\) and caf_result is not null and not \(caf_result \? 'eliminado_em'\)/);
  // O veredito fica (traffic_light não é tocado; caf_result guarda light/simulado).
  assert.doesNotMatch(corpo, /set traffic_light|set valid_until/);
});

test("toda linha que sai vai para o livro (eliminacoes_registro, motivo 'decisao'); rotina diária e rollback", () => {
  assert.equal((corpo.match(/insert into public\.eliminacoes_registro/g) ?? []).length, 5);
  assert.equal((corpo.match(/'decisao'/g) ?? []).length, 5);
  assert.match(corpo, /revoke all on function public\.e293_limpeza_retencao\(\) from public, anon, authenticated;/);
  assert.match(corpo, /cron\.schedule\('e293-limpeza-retencao', '17 4 \* \* \*', 'select public\.e293_limpeza_retencao\(\);'\)/);
  const aplicar = ler("supabase/producao/aplicar-0281.sql");
  assert.match(aplicar, /^begin;/m);
  assert.match(aplicar, /^commit;/m);
  assert.match(aplicar, /'20261101000281', '0281_e293_delecoes_retencao'/);
  assert.match(ler("supabase/producao/rollback/0281_rollback.sql"), /drop function if exists public\.e293_limpeza_retencao\(\);/);
});
