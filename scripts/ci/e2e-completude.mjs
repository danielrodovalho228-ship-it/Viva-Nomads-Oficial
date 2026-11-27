#!/usr/bin/env node
/*
  E964 — passos do job "E2E da prévia" (a lógica mora em src/lib/ci/e2e-completude.ts, com teste).
    node scripts/ci/e2e-completude.mjs grep                         (env: PR_TITULO, PR_CORPO; saída: grep= no GITHUB_OUTPUT)
    node scripts/ci/e2e-completude.mjs conferir <lista.json> <relatorio.json> [modo]
  conferir: compara os executados com os listados; escreve no resumo do job e sai 1 quando incompleto.
*/
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { extrairItens } from "../../src/lib/ci/prova-ao-vivo.ts";
import { contarExecutados, contarListados, grepDaPrevia, vereditoCompletude } from "../../src/lib/ci/e2e-completude.ts";

const resumo = (md) => {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
  console.log(md);
};
const lerJson = (arq) => {
  if (!arq || !existsSync(arq)) return null;
  try {
    return JSON.parse(readFileSync(arq, "utf8"));
  } catch {
    return null;
  }
};

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "grep") {
  const itens = extrairItens(process.env.PR_TITULO, process.env.PR_CORPO);
  const grep = grepDaPrevia(itens);
  const linha = `grep=${grep}\nitens=${itens.join(",")}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, linha);
  process.stdout.write(linha);
} else if (cmd === "conferir") {
  const [lista, relatorio, modo = ""] = args;
  const listados = contarListados(lerJson(lista));
  const executados = contarExecutados(lerJson(relatorio));
  const v = vereditoCompletude(executados, listados);
  const linhas = [`### ${v.texto}`];
  if (modo === "publico") linhas.push("modo público: specs logados não rodam em produção (as contas de teste vivem no projeto de TESTE).");
  if (!lerJson(relatorio)) linhas.push("Sem relatório da suíte (parada antes de escrever o JSON).");
  resumo(linhas.join("\n\n"));
  if (!v.ok) {
    console.log(`::error::${v.texto}`);
    process.exit(1);
  }
} else {
  console.error("uso: e2e-completude.mjs grep | conferir <lista.json> <relatorio.json> [modo]");
  process.exit(2);
}
