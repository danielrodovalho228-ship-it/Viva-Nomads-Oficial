#!/usr/bin/env node
/*
  E951 — passos da prova ao vivo no workflow e2e.yml (a lógica mora em src/lib/ci/prova-ao-vivo.ts, com teste).
    node scripts/ci/prova-ao-vivo.mjs planejar          (env: PR_TITULO, PR_CORPO ou LISTA_ITENS; saída no GITHUB_OUTPUT)
    node scripts/ci/prova-ao-vivo.mjs resultado <relatorio.json> <pasta-saida>
  planejar: itens (E\d+), o --grep e os specs etiquetados de cada item; sem item ou sem spec etiquetado → rodar=false.
  resultado: o resultado por item (resultado.json), o comentário do PR (comentario.md) e o resumo do job.
*/
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  comentarioDoPr,
  extrairItens,
  indiceDeEtiquetas,
  itensDaLista,
  montarGrep,
  resultadoPorItem,
  specsPorItem,
  testesDoRelatorio,
} from "../../src/lib/ci/prova-ao-vivo.ts";

const PASTA_SPECS = "tests/e2e/specs";
const saidaGh = (chave, valor) => {
  const linha = `${chave}=${valor}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, linha);
  process.stdout.write(linha);
};
const indice = () => {
  const specs = {};
  for (const f of readdirSync(PASTA_SPECS).filter((x) => x.endsWith(".spec.ts"))) specs[join(PASTA_SPECS, f)] = readFileSync(join(PASTA_SPECS, f), "utf8");
  return indiceDeEtiquetas(specs);
};

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "planejar") {
  const itens = process.env.LISTA_ITENS ? itensDaLista(process.env.LISTA_ITENS) : extrairItens(process.env.PR_TITULO, process.env.PR_CORPO);
  const porItem = specsPorItem(itens, indice());
  const comSpec = itens.filter((i) => porItem[i].length);
  const grep = montarGrep(comSpec);
  mkdirSync("tests/laboratorio/saida", { recursive: true });
  writeFileSync("tests/laboratorio/saida/ao-vivo-plano.json", JSON.stringify({ itens, porItem }, null, 2));
  saidaGh("itens", itens.join(","));
  saidaGh("itens_com_spec", comSpec.join(","));
  saidaGh("grep", grep ?? "");
  saidaGh("rodar", grep ? "true" : "false");
} else if (cmd === "resultado") {
  const [relatorio, pasta = "tests/laboratorio/saida"] = args;
  const plano = JSON.parse(readFileSync("tests/laboratorio/saida/ao-vivo-plano.json", "utf8"));
  const testes = relatorio && existsSync(relatorio) ? testesDoRelatorio(JSON.parse(readFileSync(relatorio, "utf8"))) : [];
  const resultado = resultadoPorItem(plano.itens, testes, plano.porItem);
  mkdirSync(pasta, { recursive: true });
  const passou = Object.values(resultado).filter((r) => r.situacao === "passou").length;
  const falhou = Object.values(resultado).filter((r) => r.situacao === "falhou").length;
  writeFileSync(join(pasta, "ao-vivo-resultado.json"), JSON.stringify({ itens: resultado, testes: { passou: testes.filter((t) => t.status === "passed").length, falhou: testes.filter((t) => !["passed", "skipped"].includes(t.status)).length, pulou: testes.filter((t) => t.status === "skipped").length } }, null, 2));
  const md = comentarioDoPr(resultado, { alvo: process.env.ALVO ?? "https://vivanomads.com.br", sha: process.env.COMMIT_SHA ?? "", runUrl: process.env.RUN_URL ?? "" });
  writeFileSync(join(pasta, "ao-vivo-comentario.md"), md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
  console.log(md);
  saidaGh("itens_passou", String(passou));
  saidaGh("itens_falhou", String(falhou));
} else {
  console.error("uso: prova-ao-vivo.mjs planejar | resultado <relatorio.json> [pasta]");
  process.exit(2);
}
