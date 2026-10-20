// Resiliência 2 — monta o manifesto da cópia (src/lib/backup/manifesto.ts) a partir dos arquivos que copia.sh juntou
// na pasta de trabalho. Imprime o JSON; formato errado ou texto com cara de dado pessoal derruba a cópia.
//   node scripts/backup/manifesto.ts <pasta-de-trabalho> <arquivo-do-dump>
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { montarManifesto } from "../../src/lib/backup/manifesto.ts";
import type { ContagemDump } from "../../src/lib/backup/dump-contagem.ts";

const [trab, arquivo] = process.argv.slice(2);
if (!trab || !arquivo) {
  console.error("uso: manifesto.ts <pasta> <arquivo-do-dump>");
  process.exit(2);
}

const caminho = join(trab, arquivo);
const sha256 = createHash("sha256").update(readFileSync(caminho)).digest("hex");
const contagem = JSON.parse(readFileSync(join(trab, "contagem.json"), "utf8")) as ContagemDump;
const chavesBrutas = JSON.parse(readFileSync(join(trab, "chaves.json"), "utf8")) as Record<string, boolean | null>;
const chaves = Object.fromEntries(Object.entries(chavesBrutas).filter(([, v]) => typeof v === "boolean"));

// buckets.tsv: "bucket<TAB>objetos<TAB>bytes" (de rclone size --json, um por bucket).
const buckets: Record<string, { objetos: number; bytes: number }> = {};
for (const l of readFileSync(join(trab, "buckets.tsv"), "utf8").split("\n")) {
  if (!l.trim()) continue;
  const [nome, objetos, bytes] = l.split("\t");
  buckets[nome] = { objetos: Number(objetos), bytes: Number(bytes) };
}

const m = montarManifesto({
  geradoEm: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  dump: { arquivo, bytes: statSync(caminho).size, sha256 },
  tabelas: contagem.tabelas,
  buckets,
  migracoes: contagem.migracoes,
  chaves,
});
process.stdout.write(JSON.stringify(m, null, 2));
