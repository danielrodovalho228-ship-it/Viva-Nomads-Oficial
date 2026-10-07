// Gera supabase/producao/conferir-esquema.sql: para cada migração do repo, lista
// tabelas/colunas/funções que ela cria e que NÃO existem no banco onde o SQL roda.
// Uso: node scripts/gerar-conferir-esquema.mjs  (rode de novo a cada migração nova)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const DIR = "supabase/migrations";
let linhas = [];
/** tabela → última migração que a apagou (drop table). */
const apagadas = new Map();
for (const f of readdirSync(DIR).filter((n) => n.endsWith(".sql")).sort()) {
  const m = f.slice(0, 4);
  const s = readFileSync(`${DIR}/${f}`, "utf8").replace(/--[^\n]*/g, "");
  for (const [, t] of s.matchAll(/create table (?:if not exists )?(?:public\.)?(\w+)/gi)) linhas.push([m, "T", t, ""]);
  for (const [, t, corpo] of s.matchAll(/alter table (?:if exists )?(?:only )?(?:public\.)?(\w+)\s+(add column[^;]*)/gi))
    for (const [, c] of corpo.matchAll(/add column (?:if not exists )?(\w+)/gi)) linhas.push([m, "C", t, c]);
  for (const [, fn] of s.matchAll(/create (?:or replace )?function (?:public\.)?(\w+)/gi)) linhas.push([m, "F", fn, ""]);
  for (const [, t] of s.matchAll(/drop table (?:if exists )?(?:public\.)?(\w+)/gi)) apagadas.set(t, m);
}
// O que uma migração posterior apagou não é cobrado (se foi recriada, vale a nova linha).
linhas = linhas.filter(([m, k, t]) => !((k === "T" || k === "C") && apagadas.has(t) && m < apagadas.get(t)));
const valores = linhas.map((l) => `('${l.join("','")}')`).join(",\n  ");
writeFileSync(
  "supabase/producao/conferir-esquema.sql",
  `-- GERADO por scripts/gerar-conferir-esquema.mjs — não edite à mão. Só LEITURA.
-- Lista, por migração, o que ela cria e NÃO existe neste banco. Esperado: 0 linhas
-- (exceto migrações ainda não aplicadas de propósito).
with e(m, k, t, c) as (values
  ${valores}
)
select m as migracao,
       string_agg(k || ':' || t || case when c <> '' then '.' || c else '' end, ', ') as faltando
from e
where not (
  (k = 'T' and exists (select 1 from information_schema.tables x where x.table_schema = 'public' and x.table_name = e.t))
  or (k = 'C' and exists (select 1 from information_schema.columns x where x.table_schema = 'public' and x.table_name = e.t and x.column_name = e.c))
  or (k = 'F' and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = e.t))
)
group by m order by m;
`
);
console.log(`conferir-esquema.sql: ${linhas.length} itens de ${new Set(linhas.map((l) => l[0])).size} migrações`);
