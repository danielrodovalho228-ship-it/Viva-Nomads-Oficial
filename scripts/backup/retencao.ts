// Resiliência 2 — transforma as listas das pastas do Drive (decifradas; só nomes AAAA-MM-DD_HHMM.dump e AAAA-MM-DD)
// no plano de retenção (planoRetencao em src/lib/backup/retencao.ts): uma ação por linha, que copia.sh executa.
//   node scripts/backup/retencao.ts <hoje AAAA-MM-DD> <pasta-de-trabalho>
// Lê lista_diario.txt, lista_semanal.txt, lista_mensal.txt, lista_manifestos.txt e lista_removidos.txt da pasta.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { planoRetencao } from "../../src/lib/backup/retencao.ts";

const [hoje, trab] = process.argv.slice(2);
const ler = (n: string) => {
  const c = join(trab, `lista_${n}.txt`);
  return existsSync(c)
    ? readFileSync(c, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    : [];
};
const plano = planoRetencao(hoje, { diario: ler("diario"), semanal: ler("semanal"), mensal: ler("mensal") }, ler("manifestos"), ler("removidos"));
process.stdout.write(plano.join("\n") + (plano.length ? "\n" : ""));
