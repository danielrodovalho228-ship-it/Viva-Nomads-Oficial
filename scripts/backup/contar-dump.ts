// Resiliência 2 — conta as linhas por tabela lendo o dump (pg_restore --data-only -f - <dump> | node contar-dump.ts).
// Os dados passam só pela memória; sai um JSON com contagens e a lista de migrações (src/lib/backup/dump-contagem.ts).
import { createInterface } from "node:readline";
import { ContadorDump } from "../../src/lib/backup/dump-contagem.ts";

const contador = new ContadorDump();
const linhas = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const l of linhas) contador.linha(l);
const r = contador.resultado();
if (Object.keys(r.tabelas).length === 0) {
  console.error("Nenhuma tabela no dump.");
  process.exit(1);
}
process.stdout.write(JSON.stringify(r));
