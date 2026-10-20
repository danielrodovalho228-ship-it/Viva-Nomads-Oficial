// Resiliência 2 — roda as 5 consultas-chave (src/lib/backup/consultas-chave.ts) no banco da variável pedida e imprime
// {"contrato":true,…}; consulta com erro vira null. Só true/false: nenhuma linha sai daqui.
//   node scripts/backup/consultas-chave.ts SUPABASE_DB_URL
import { CONSULTAS_CHAVE, type NomeConsultaChave } from "../../src/lib/backup/consultas-chave.ts";
import { psql, urlDoAmbiente } from "./psql.ts";

export function rodarConsultasChave(url: string): Record<NomeConsultaChave, boolean | null> {
  const r = {} as Record<NomeConsultaChave, boolean | null>;
  for (const [nome, sql] of Object.entries(CONSULTAS_CHAVE) as [NomeConsultaChave, string][]) {
    try {
      const s = psql(url, sql).trim();
      r[nome] = s === "t" ? true : s === "f" ? false : null;
    } catch {
      r[nome] = null;
    }
  }
  return r;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = urlDoAmbiente(process.argv[2] ?? "SUPABASE_DB_URL");
  process.stdout.write(JSON.stringify(rodarConsultasChave(url)));
}
