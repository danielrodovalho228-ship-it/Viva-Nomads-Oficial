import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/*
  Correção do coordenador (reteste do #866, item 5 da matriz da taxa): a taxa continuava legível pelo morador via API
  em contratos.comissao_* e leads.accepted_*. A 0177 tira o SELECT dessas colunas de authenticated/anon (padrão do #866)
  e as telas do dono leem a taxa no servidor, com o cliente de serviço, depois de conferir que é o dono.
*/
const ler = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const SRC = fileURLToPath(new URL("..", import.meta.url));

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

test("guarda: nenhum select('*') em contratos ou leads com o cliente de sessão em src/", () => {
  const achados: string[] = [];
  const re = /([\w.]+)\s*\.from\(\s*["'`](contratos|leads)["'`]\s*\)\s*\.select\(\s*["'`]\*/g;
  for (const f of arquivos(SRC)) {
    const s = readFileSync(f, "utf8");
    for (const m of s.matchAll(re)) if (!/admin/i.test(m[1])) achados.push(`${f}: ${m[1]}.from("${m[2]}").select("*…")`);
  }
  assert.deepEqual(achados, []);
});

test("guarda: nenhuma leitura de coluna de taxa de contratos/leads com o cliente de sessão", () => {
  const COLUNAS = /comissao_valor|comissao_percent|valor_comissao|taxa_aplicada|faixa_no_fechamento|modelo_cobranca|accepted_commission_rate|accepted_plan|accepted_commission_origem|accepted_commission_faixa/;
  const achados: string[] = [];
  const re = /([\w.]+)\s*\.from\(\s*["'`](contratos|leads)["'`]\s*\)\s*\.select\(\s*([`"'])([\s\S]*?)\3/g;
  for (const f of arquivos(SRC)) {
    const s = readFileSync(f, "utf8");
    for (const m of s.matchAll(re)) if (!/admin/i.test(m[1]) && COLUNAS.test(m[4])) achados.push(`${f}: ${m[1]} → ${m[4].slice(0, 80)}`);
  }
  assert.deepEqual(achados, []);
});

test("migração 0177: revoga o SELECT das colunas de taxa e devolve só as que já eram legíveis", () => {
  const mig = ler("../../supabase/migrations/0177_taxa_fora_da_api.sql");
  for (const c of ["comissao_valor", "comissao_percent", "valor_comissao", "accepted_commission_rate", "accepted_plan", "accepted_commission_origem", "accepted_commission_faixa"]) {
    assert.match(mig, new RegExp(`'${c}'`), c);
  }
  assert.match(mig, /has_column_privilege\(r, format\('public\.%I', t\), c\.column_name, 'SELECT'\)/, "não abre coluna que hoje está fechada");
  assert.match(mig, /revoke select on public\.%I from %I/);
  assert.match(mig, /grant select \(%s\) on public\.%I to %I/);
  const prod = ler("../../supabase/producao/aplicar-0177.sql");
  assert.match(prod, /^begin;/m);
  assert.match(prod, /'20261019000177', '0177_taxa_fora_da_api'/);
  assert.match(prod, /commit;\s*$/);
  assert.match(ler("../../supabase/producao/rollback/0177_rollback.sql"), /grant select on public\.contratos to authenticated, anon;/);
});

test("as telas do dono leem a taxa no servidor, só depois de conferir que é o dono", () => {
  const srv = ler("./data/taxa-dono-servidor.ts");
  assert.match(srv, /properties!inner\(owner_id\)[\s\S]*\.eq\("properties\.owner_id", ownerId\)/);
  assert.match(srv, /\.eq\("id", leadId\)\.eq\("owner_id", ownerId\)/);
  assert.match(ler("./data/contratos-actions.ts"), /taxaDosContratosDoDono\(admin, user\.id,/);
  assert.match(ler("./data/leads-actions.ts"), /taxaDoLeadDoDono\(admin, user\.id, lead\.id as string\)/);
  assert.match(ler("./data/fechamento-servidor.ts"), /taxaDoLeadDoDono\(admin, user\.id, lead\.id as string\)/);
  assert.match(ler("./data/actions.ts"), /taxaDoLeadDoDono\(admin, user\.id, lead\.id as string\)/);
  // O morador: a lista de locações já era fechada e continua sem a taxa.
  const acoes = ler("./data/contratos-actions.ts");
  const loc = acoes.slice(acoes.indexOf("export async function getMinhasLocacoes"), acoes.indexOf("export async function getMeusContratos"));
  assert.doesNotMatch(loc, /comissao/);
});
