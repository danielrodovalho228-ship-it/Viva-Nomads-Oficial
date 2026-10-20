import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Trava de numeração das migrações (pista B, fila 1). Roda no CI de todo PR — que testa o PR
 * já mesclado com a main —, então dois PRs com o mesmo NNNN quebram no segundo a entrar.
 *  • cada número NNNN aparece em uma só migração de supabase/migrations;
 *  • todo supabase/producao/aplicar-NNNN.sql tem a migração NNNN_nome.sql par e se registra
 *    com esse mesmo nome (é o nome que a Action usa para saber se já aplicou);
 *  • nenhuma versão de schema_migrations se repete entre os aplicar-NNNN (versão copiada faz o
 *    "where not exists" pular a migração nova).
 */
const MIGRACOES = "supabase/migrations";
const PRODUCAO = "supabase/producao";

interface Aplicar {
  arquivo: string;
  conteudo: string;
}

function problemasDeNumeracao(migracoes: string[], aplicar: Aplicar[]): string[] {
  const problemas: string[] = [];
  const porNumero = new Map<string, string[]>();
  for (const arq of migracoes) {
    if (!arq.endsWith(".sql")) continue;
    const m = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(arq);
    if (!m) {
      problemas.push(`${arq}: nome fora do padrão NNNN_nome.sql`);
      continue;
    }
    porNumero.set(m[1], [...(porNumero.get(m[1]) ?? []), arq.slice(0, -4)]);
  }
  for (const [n, nomes] of porNumero) {
    if (nomes.length > 1) problemas.push(`número ${n} repetido: ${nomes.map((x) => `${x}.sql`).join(", ")}`);
  }

  const versoes = new Map<string, string[]>();
  for (const { arquivo, conteudo } of aplicar) {
    const m = /^aplicar-(\d{4})\.sql$/.exec(arquivo);
    if (!m) continue;
    const n = m[1];
    const pares = porNumero.get(n);
    if (!pares) {
      problemas.push(`${arquivo} sem migração par ${n}_*.sql`);
      continue;
    }
    const registros = [...conteudo.matchAll(/'(\d{14})'\s*,\s*'(\d{4}_[a-z0-9_]+)'/g)];
    const doNumero = registros.filter((r) => r[2].startsWith(`${n}_`));
    if (doNumero.length === 0) {
      problemas.push(`${arquivo} não se registra em schema_migrations com o nome '${n}_…'`);
    } else if (!doNumero.some((r) => pares.includes(r[2]))) {
      problemas.push(`${arquivo} se registra como '${doNumero[0][2]}', mas a migração é ${pares[0]}.sql`);
    }
    for (const r of registros) versoes.set(r[1], [...new Set([...(versoes.get(r[1]) ?? []), arquivo])]);
  }
  for (const [v, arqs] of versoes) {
    if (arqs.length > 1) problemas.push(`versão ${v} repetida em ${arqs.join(", ")}`);
  }
  return problemas;
}

function lerAplicar(): Aplicar[] {
  return readdirSync(PRODUCAO)
    .filter((a) => a.startsWith("aplicar-") && a.endsWith(".sql"))
    .map((arquivo) => ({ arquivo, conteudo: readFileSync(join(PRODUCAO, arquivo), "utf8") }));
}

test("migrações do repositório: sem número repetido e todo aplicar-NNNN com migração par", () => {
  assert.deepEqual(problemasDeNumeracao(readdirSync(MIGRACOES), lerAplicar()), []);
});

const registro = (v: string, nome: string) =>
  `begin;\ninsert into supabase_migrations.schema_migrations (version, name, statements, created_by)\n` +
  `select '${v}', '${nome}', array['x'], 'x'\n where not exists (select 1);\ncommit;\n`;

test("acusa número de migração repetido", () => {
  const p = problemasDeNumeracao(["0196_a.sql", "0196_b.sql", "0197_c.sql"], []);
  assert.deepEqual(p, ["número 0196 repetido: 0196_a.sql, 0196_b.sql"]);
});

test("acusa aplicar-NNNN sem migração par", () => {
  const p = problemasDeNumeracao(["0196_a.sql"], [
    { arquivo: "aplicar-0196.sql", conteudo: registro("20261021000196", "0196_a") },
    { arquivo: "aplicar-0197.sql", conteudo: registro("20261021000197", "0197_b") },
  ]);
  assert.deepEqual(p, ["aplicar-0197.sql sem migração par 0197_*.sql"]);
});

test("acusa aplicar-NNNN registrado com nome diferente da migração ou sem registro", () => {
  const p = problemasDeNumeracao(["0196_certo.sql", "0197_b.sql"], [
    { arquivo: "aplicar-0196.sql", conteudo: registro("20261021000196", "0196_errado") },
    { arquivo: "aplicar-0197.sql", conteudo: "begin;\ncommit;\n" },
  ]);
  assert.deepEqual(p, [
    "aplicar-0196.sql se registra como '0196_errado', mas a migração é 0196_certo.sql",
    "aplicar-0197.sql não se registra em schema_migrations com o nome '0197_…'",
  ]);
});

test("acusa versão de schema_migrations copiada de outro aplicar", () => {
  const p = problemasDeNumeracao(["0196_a.sql", "0197_b.sql"], [
    { arquivo: "aplicar-0196.sql", conteudo: registro("20261021000196", "0196_a") },
    { arquivo: "aplicar-0197.sql", conteudo: registro("20261021000196", "0197_b") },
  ]);
  assert.deepEqual(p, ["versão 20261021000196 repetida em aplicar-0196.sql, aplicar-0197.sql"]);
});

test("aceita o formato antigo (values … on conflict) e ignora aplicar fora do padrão NNNN", () => {
  const antigo =
    "insert into supabase_migrations.schema_migrations (version, name, statements, created_by)\n" +
    "values ('20261007000076', '0076_garantia_unica', array['x'], 'x')\non conflict (version) do nothing;";
  const p = problemasDeNumeracao(["0076_garantia_unica.sql", "README.md"], [
    { arquivo: "aplicar-0076.sql", conteudo: antigo },
    { arquivo: "aplicar-0046-0047-0048.sql", conteudo: "" },
    { arquivo: "aplicar-piloto.sql", conteudo: "" },
  ]);
  assert.deepEqual(p, []);
});
