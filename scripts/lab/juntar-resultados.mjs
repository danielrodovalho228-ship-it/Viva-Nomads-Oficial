/*
  E744 — junta os resultado.json das fatias do laboratório (uma por job da matriz) num só, para o resumo e para o
  registro em public.lab_execucoes continuarem sendo UMA linha por execução.

  Uso: node scripts/lab/juntar-resultados.mjs <pasta-com-as-fatias> <saida.json> [--esperadas N]
  Procura todo "resultado.json" dentro da pasta (cada fatia vem em uma subpasta do artifact), concatena as `suites`
  e soma os `stats`. Fatia sem arquivo (runner morreu antes de gravar) não derruba a junção: avisa e segue com o que há.
*/
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Todos os caminhos de resultado.json sob `pasta`, em ordem estável. */
export function acharResultados(pasta) {
  const achados = [];
  if (!existsSync(pasta)) return achados;
  const varrer = (dir) => {
    for (const nome of readdirSync(dir).sort()) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) varrer(p);
      else if (nome === "resultado.json") achados.push(p);
    }
  };
  varrer(pasta);
  return achados;
}

/** Junta relatórios JSON do Playwright: suites concatenadas, stats somados. */
export function juntar(relatorios) {
  const base = relatorios[0] ? { ...relatorios[0] } : { config: {}, suites: [], errors: [], stats: {} };
  base.suites = relatorios.flatMap((r) => r.suites ?? []);
  base.errors = relatorios.flatMap((r) => r.errors ?? []);
  const stats = {};
  for (const r of relatorios) for (const [k, v] of Object.entries(r.stats ?? {})) if (typeof v === "number") stats[k] = (stats[k] ?? 0) + v;
  base.stats = { ...(relatorios[0]?.stats ?? {}), ...stats };
  return base;
}

function principal() {
  const args = process.argv.slice(2);
  const esperadasArg = args.indexOf("--esperadas");
  const esperadas = esperadasArg >= 0 ? Number(args[esperadasArg + 1]) : null;
  const pos = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--esperadas");
  const [pasta, saida] = pos;
  if (!pasta || !saida) {
    console.error("uso: juntar-resultados.mjs <pasta> <saida.json> [--esperadas N]");
    process.exit(2);
  }
  const caminhos = acharResultados(pasta);
  const relatorios = [];
  for (const c of caminhos) {
    try {
      relatorios.push(JSON.parse(readFileSync(c, "utf8")));
    } catch {
      console.error(`::warning::resultado ilegível, ignorado: ${c}`);
    }
  }
  if (esperadas !== null && relatorios.length < esperadas) {
    console.error(`::warning::só ${relatorios.length} de ${esperadas} fatias entregaram resultado: os números abaixo são parciais.`);
  }
  mkdirSync(dirname(saida), { recursive: true });
  writeFileSync(saida, JSON.stringify(juntar(relatorios)));
  console.log(`${relatorios.length} fatia(s) juntadas em ${saida}`);
}

if (import.meta.url === `file://${process.argv[1]}`) principal();
