// Resiliência 2 — psql sem vazar nada: a URL vem de uma variável de ambiente (nunca de argumento impresso), a saída
// de erro é descartada (pode ter valor de coluna) e o erro que sobe só diz "a consulta falhou".
import { execFileSync } from "node:child_process";

export function urlDoAmbiente(nomeVar: string): string {
  const url = process.env[nomeVar]?.trim();
  if (!url) throw new Error(`falta a variável ${nomeVar}`);
  return url;
}

/** Roda uma consulta e devolve a saída "-At" (sem cabeçalho, separador "|"). */
export function psql(url: string, sql: string): string {
  const bin = process.env.PSQL || "psql";
  try {
    return execFileSync(bin, [url, "-X", "-q", "-At", "-F", "|", "-v", "ON_ERROR_STOP=1", "-c", sql], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    throw new Error("a consulta falhou");
  }
}

/** Contagem exata de linhas de cada tabela dos schemas pedidos, numa consulta só. */
export function sqlContagens(schemas: readonly string[]): string {
  const lista = schemas.map((s) => `'${s.replace(/'/g, "''")}'`).join(", ");
  return `select table_schema || '.' || table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text from information_schema.tables where table_type = 'BASE TABLE' and table_schema in (${lista}) order by 1`;
}

export function lerContagens(saida: string): Record<string, number> {
  const r: Record<string, number> = {};
  for (const l of saida.split("\n")) {
    if (!l.trim()) continue;
    const i = l.lastIndexOf("|");
    r[l.slice(0, i)] = Number(l.slice(i + 1));
  }
  return r;
}
