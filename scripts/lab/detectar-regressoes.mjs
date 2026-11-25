/*
  Frente 0 (11/11/2026) — detector de regressão do laboratório.
  Regressão = spec que tem ALGUM registro verde em public.lab_execucoes e está vermelho na rodada atual.
    verde    (num registro): passou > 0 e falhou = 0 (instável conta como verde: passou na 2ª tentativa);
    vermelho (rodada atual): falhou > 0.
  O histórico vem do banco ANTES de gravar a rodada atual (o consolidar monta {spec: último verde} com psql; registros de
  pull_request ficam de fora: era código que ainda não estava na main). Lista não vazia deixa o job vermelho e vai para o
  resumo da rodada.

  Uso: node scripts/lab/detectar-regressoes.mjs <verdes.json> <resultado.json> [--saida regressoes.json]
    verdes.json    = {"t132-solicitar-reserva.spec.ts": "2026-10-23T09:12:00Z", ...}
    resultado.json = o relatório juntado das fatias (o mesmo que vai para o banco).
*/
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { coletar, resumoJson } from "./resumo-specs.mjs";

/** [{ spec, ultimoVerde, falhou }] dos specs verdes no histórico e vermelhos agora, em ordem de número do spec. */
export function detectarRegressoes(verdes, porSpecAtual) {
  const saida = [];
  for (const [spec, l] of Object.entries(porSpecAtual ?? {})) {
    const falhou = Number(l?.falhou ?? 0);
    if (falhou > 0 && verdes?.[spec]) saida.push({ spec, ultimoVerde: verdes[spec], falhou });
  }
  const numero = (s) => Number((/^t(\d+)/.exec(s) ?? [])[1] ?? 1e9);
  return saida.sort((a, b) => numero(a.spec) - numero(b.spec) || a.spec.localeCompare(b.spec));
}

export function textoRegressoes(lista) {
  if (!lista.length) return "### Regressões\n✅ Nenhuma regressão: nenhum spec que já foi verde está vermelho nesta rodada.";
  const linhas = [
    "### Regressões",
    `❌ ${lista.length} spec voltou a falhar depois de já ter passado${lista.length > 1 ? " (cada um)" : ""}:`,
    "",
    "| Spec | Último verde | Testes que falharam agora |",
    "|---|---|---|",
  ];
  for (const r of lista) linhas.push(`| ${r.spec} | ${String(r.ultimoVerde).slice(0, 10)} | ${r.falhou} |`);
  return linhas.join("\n");
}

function principal() {
  const args = process.argv.slice(2);
  const iSaida = args.indexOf("--saida");
  const saida = iSaida >= 0 ? args[iSaida + 1] : null;
  const [arqVerdes, arqResultado] = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--saida");
  if (!arqVerdes || !arqResultado) {
    console.error("uso: detectar-regressoes.mjs <verdes.json> <resultado.json> [--saida regressoes.json]");
    process.exit(2);
  }
  // Sem histórico não dá para afirmar que não houve regressão: vermelho, com o motivo.
  if (!existsSync(arqVerdes)) {
    console.log("### Regressões\n❌ Sem o histórico de lab_execucoes: o detector não pôde rodar.");
    process.exit(1);
  }
  const verdes = JSON.parse(readFileSync(arqVerdes, "utf8"));
  const dados = existsSync(arqResultado) ? JSON.parse(readFileSync(arqResultado, "utf8")) : { suites: [] };
  const lista = detectarRegressoes(verdes, resumoJson(coletar(dados.suites)).por_spec);
  if (saida) writeFileSync(saida, JSON.stringify(lista));
  console.log(textoRegressoes(lista));
  if (lista.length) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) principal();
