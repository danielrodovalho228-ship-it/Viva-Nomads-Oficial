/*
  Roda: node --test tests/migracoes/escada-sem-gestor-0344.test.ts
  Prompt 078 (decisão do Daniel, 16/11/2026): a tabela faixas_comissao passa a terminar em "16 ou mais = 6%" e perde a
  faixa de 20+ a 4% (0293). A migração espelha FAIXAS_COMISSAO_PADRAO (src/lib/cobranca/regra.ts): a regra e a tabela
  dizem a mesma escada. A aplicação de verdade (aplica, reaplica sem duplicar, desfaz) é provada no Postgres do
  laboratório; a saída vai na descrição do PR.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAIXAS_COMISSAO_PADRAO } from "../../src/lib/cobranca/regra.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const sql = (s: string) => s.replace(/--[^\n]*/g, "");
const MIGRACAO = "supabase/migrations/0344_escada_sem_gestor_078.sql";
const APLICAR = "supabase/producao/aplicar-0344.sql";
const ROLLBACK = "supabase/producao/rollback/0344_rollback.sql";

/** As linhas `(min, max, taxa)` do insert, como a regra as escreve. */
function faixasDoInsert(s: string): { minImoveis: number; maxImoveis: number | null; taxa: number }[] {
  const bloco = s.match(/insert into public\.faixas_comissao \(min_imoveis, max_imoveis, taxa\) values([\s\S]*?)on conflict/i)?.[1] ?? "";
  return [...bloco.matchAll(/\(\s*(\d+)\s*,\s*(\d+|null)\s*,\s*([\d.]+)\s*\)/g)].map((m) => ({
    minImoveis: Number(m[1]),
    maxImoveis: m[2] === "null" ? null : Number(m[2]),
    taxa: Number(m[3]),
  }));
}

test("0344 (arquivo e aplicar): a tabela fica igual à regra — 12/10/8/6, com 16 ou mais sem teto — e sai a faixa de 20+", () => {
  for (const arquivo of [MIGRACAO, APLICAR]) {
    const s = sql(ler(arquivo));
    assert.deepEqual(faixasDoInsert(s), FAIXAS_COMISSAO_PADRAO.map((f) => ({ minImoveis: f.minImoveis, maxImoveis: f.maxImoveis, taxa: f.taxa })), arquivo);
    assert.match(s, /delete from public\.faixas_comissao where min_imoveis in \(20, 31\);/, arquivo);
    assert.match(s, /on conflict \(min_imoveis\) do update set max_imoveis = excluded\.max_imoveis, taxa = excluded\.taxa;/, `${arquivo}: reaplicar não duplica`);
    assert.match(s, /select public\.atualizar_faixas_dos_donos\(\);/, arquivo);
    assert.doesNotMatch(s, /0\.04/, `${arquivo}: nenhuma faixa de 4%`);
    // Fora do escopo: taxa congelada, contratos, propostas, taxa fixada pelo admin e qualquer dado de conta.
    assert.doesNotMatch(s, /contratos|propostas|taxa_congelada|comissao_fixada_admin|profiles|auth\.|drop\s|truncate/i, arquivo);
  }
});

test("0344: aplicar entre begin/commit, registrado uma vez; o rollback volta à tabela da 0293 e tira o registro", () => {
  const apl = ler(APLICAR);
  assert.match(apl, /^-- [^\n]*\n-- [^\n]*\nbegin;/);
  assert.match(apl, /commit;\s*$/);
  assert.match(apl, /'20261116000344', '0344_escada_sem_gestor_078'\s*where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261116000344'\);/);
  const rb = sql(ler(ROLLBACK));
  assert.match(rb, /^\s*begin;[\s\S]*commit;\s*$/);
  assert.match(rb, /update public\.faixas_comissao set max_imoveis = 19, taxa = 0\.06 where min_imoveis = 16;/);
  assert.match(rb, /values \(20, null, 0\.04\)\s*on conflict \(min_imoveis\) do update/);
  assert.match(rb, /select public\.atualizar_faixas_dos_donos\(\);/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261116000344';/);
});

test("0344: o servidor lê a tabela sem tratar a faixa sem teto como plano, e a regra padrão é a mesma escada", () => {
  const servidor = ler("src/lib/cobranca/taxa-servidor.ts");
  assert.match(servidor, /from\("faixas_comissao"\)\.select\("min_imoveis, max_imoveis, taxa"\)\.order\("min_imoveis"\)/);
  assert.doesNotMatch(servidor, /gestor: true|account_type/);
  assert.deepEqual(FAIXAS_COMISSAO_PADRAO.at(-1), { minImoveis: 16, maxImoveis: null, taxa: 0.06 });
});
