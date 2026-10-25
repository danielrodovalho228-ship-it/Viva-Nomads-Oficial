// Resiliência 2 — conferência do teste de restauração (comparações puras em src/lib/backup/drill.ts).
//   node scripts/drill/conferir.ts dump <manifesto.json>                 → imprime o nome do dump (AAAA-MM-DD_HHMM.dump)
//   node scripts/drill/conferir.ts hash <manifesto.json> <arquivo>       → confere tamanho e SHA-256 do dump baixado
//   node scripts/drill/conferir.ts conferir <pasta> <erros-do-pg_restore>
//   node scripts/drill/conferir.ts livro                                 → reaplica o livro de eliminações (Prompt 58)
// O "conferir" lê o banco restaurado (DRILL_DB_URL) e o backup do storage (DESTINO, rclone): migrações registradas =
// repositório e = manifesto; linhas por tabela = manifesto; as 5 consultas-chave; e 20 objetos sorteados do storage
// baixados, decifrados e comparados com o Supabase (rclone check --download). Imprime só nomes de conferência,
// nomes de tabela e números — nunca linha de dado nem nome de arquivo (a lista sorteada fica em arquivo privado).
import { createHash, randomInt } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lerManifesto } from "../../src/lib/backup/manifesto.ts";
import {
  SQL_LIVRO_REAPLICAR,
  SQL_LIVRO_VOLTOU,
  TAMANHO_AMOSTRA,
  compararContagens,
  conferirLivro,
  lerLivro,
  compararMigracoes,
  conferirAmostra,
  conferirChaves,
  lerCheckCombinado,
  motivoDoDrill,
  sortearAmostra,
  type Conferencia,
} from "../../src/lib/backup/drill.ts";
import { psql, sqlContagens, lerContagens, urlDoAmbiente } from "../backup/psql.ts";
import { rodarConsultasChave } from "../backup/consultas-chave.ts";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const [acao, a1, a2] = process.argv.slice(2);
const SCHEMAS = ["public", "auth", "storage", "supabase_migrations"];

function sair(msg: string): never {
  console.error(msg);
  process.exit(1);
}

if (acao === "dump") {
  const m = lerManifesto(readFileSync(a1, "utf8"));
  process.stdout.write(m.dump.arquivo);
  process.exit(0);
}

if (acao === "hash") {
  const m = lerManifesto(readFileSync(a1, "utf8"));
  const bytes = statSync(a2).size;
  const sha = createHash("sha256").update(readFileSync(a2)).digest("hex");
  if (bytes !== m.dump.bytes || sha !== m.dump.sha256) sair(`  o dump baixado não bate com o manifesto (tamanho ${bytes} × ${m.dump.bytes}; hash ${sha === m.dump.sha256 ? "igual" : "diferente"})`);
  console.log(`  dump íntegro: ${bytes} bytes, SHA-256 igual ao do manifesto`);
  process.exit(0);
}

// Prompt 58: o livro de eliminações reaplicado. O livro vem da produção (SUPABASE_DB_URL, só leitura), que tem as
// eliminações feitas depois do backup; sem ela, o do próprio restaurado. Nada eliminado pode voltar.
function reaplicarLivro(url: string): Conferencia {
  const bin = process.env.PSQL || "psql";
  const sessao = (sql: string) =>
    execFileSync(bin, [url, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
  try {
    if (psql(url, "select to_regclass('public.eliminacoes_registro') is null").trim() === "t") return conferirLivro(0, 0, 0, true);
    const fonte = process.env.SUPABASE_DB_URL?.trim() || url;
    const livro = lerLivro(psql(fonte, "select origem || '|' || ref_id from public.eliminacoes_registro where modo = 'apagado' and origem like 'bucket:%'"));
    const valores = livro.map((l) => `('${l.origem}','${l.ref}')`).join(",");
    const contagens = sessao(
      ["create temp table _livro (origem text, ref text)", ...(valores ? [`insert into _livro values ${valores}`] : []), SQL_LIVRO_VOLTOU, SQL_LIVRO_REAPLICAR, SQL_LIVRO_VOLTOU].join(";\n") + ";\n",
    )
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^\d+$/.test(l));
    return conferirLivro(livro.length, Number(contagens[0]), Number(contagens[1]), false);
  } catch {
    return conferirLivro(0, null, null, false);
  }
}

// Restauração de verdade (docs/RESTAURACAO.md, B5): DRILL_DB_URL = o banco novo.
if (acao === "livro") {
  const c = reaplicarLivro(urlDoAmbiente("DRILL_DB_URL"));
  console.log(`  ${c.ok ? "✔" : "✘"} ${c.nome} — ${c.detalhe}`);
  process.exit(c.ok ? 0 : 1);
}

if (acao !== "conferir" || !a1) sair("uso: conferir.ts <dump|hash|conferir|livro> …");

const trab = a1;
const errosRestore = Number(a2 ?? "0") || 0;
const manifesto = lerManifesto(readFileSync(join(trab, "manifesto.json"), "utf8"));
writeFileSync(join(trab, "res_objetos_storage"), String(manifesto.storage.objetos));
writeFileSync(join(trab, "res_bytes_storage"), String(manifesto.storage.bytes));
const url = urlDoAmbiente("DRILL_DB_URL");
const conferencias: Conferencia[] = [];

conferencias.push({
  nome: "pg_restore sem erros",
  ok: errosRestore === 0,
  detalhe: errosRestore === 0 ? "nenhum erro" : `${errosRestore} erro(s) na restauração`,
});

// Migrações.
try {
  const restauradas = psql(url, "select rtrim(version || ' ' || coalesce(name, '')) from supabase_migrations.schema_migrations order by 1")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const repo = readdirSync(join(RAIZ, "supabase", "producao"))
    .map((f) => /^aplicar-(\d{4})\.sql$/.exec(f)?.[1])
    .filter((n): n is string => !!n)
    .map(Number);
  conferencias.push(compararMigracoes(manifesto.migracoes.lista, restauradas, repo));
} catch {
  conferencias.push({ nome: "Migrações registradas = repositório", ok: false, detalhe: "não foi possível ler supabase_migrations no restaurado" });
}

// Linhas por tabela.
try {
  conferencias.push(compararContagens(manifesto.tabelas, lerContagens(psql(url, sqlContagens(SCHEMAS)))));
} catch {
  conferencias.push({ nome: "Linhas por tabela = manifesto", ok: false, detalhe: "não foi possível contar as tabelas restauradas" });
}

// As 5 consultas-chave.
conferencias.push(...conferirChaves(manifesto.chaves, rodarConsultasChave(url)));

// Amostra de 20 objetos do storage: baixados e decifrados do backup, comparados byte a byte com o Supabase.
{
  const rclone = process.env.RCLONE_BIN || "rclone";
  const destino = process.env.DESTINO || "cripto:VivaNomads-Backup";
  const rlog = process.env.RLOG || join(trab, "rclone.log");
  const base = ["--config", process.env.RCLONE_CONFIG ?? "", "--log-file", rlog, "--log-level", "NOTICE", "--stats", "0"];
  let sorteados = 0;
  let falhou = false;
  let r = { iguais: 0, diferentes: 0 };
  try {
    const lista = execFileSync(rclone, [...base, "lsf", "-R", "--files-only", `${destino}/storage/atual/`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 256 * 1024 * 1024,
    })
      .split("\n")
      .filter(Boolean);
    const amostra = sortearAmostra(lista, TAMANHO_AMOSTRA, () => randomInt(0, 2 ** 32) / 2 ** 32);
    sorteados = amostra.length;
    if (sorteados > 0) {
      writeFileSync(join(trab, "amostra.txt"), amostra.join("\n") + "\n", { mode: 0o600 });
      writeFileSync(join(trab, "check.txt"), "", { mode: 0o600 });
      try {
        execFileSync(
          rclone,
          [...base, "check", "s3supabase:", `${destino}/storage/atual/`, "--files-from", join(trab, "amostra.txt"), "--download", "--one-way", "--combined", join(trab, "check.txt")],
          { stdio: "ignore" },
        );
      } catch {
        // Diferença também sai com código ≠ 0; o arquivo --combined diz quantos bateram.
      }
      r = lerCheckCombinado(readFileSync(join(trab, "check.txt"), "utf8"));
    }
  } catch {
    falhou = true;
  }
  conferencias.push(conferirAmostra(sorteados, r, falhou));
}

conferencias.push(reaplicarLivro(url));

for (const c of conferencias) console.log(`  ${c.ok ? "✔" : "✘"} ${c.nome} — ${c.detalhe}`);
const motivo = motivoDoDrill(conferencias);
if (motivo) {
  writeFileSync(join(trab, "motivo_drill.txt"), motivo, { mode: 0o600 });
  process.exit(1);
}
