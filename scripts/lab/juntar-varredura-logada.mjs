#!/usr/bin/env node
/*
  E950 — junta as parciais da varredura logada/admin (uma por persona × largura, gravadas pela t1649 em
  tests/laboratorio/saida/varredura-logada-e950/, ou nas pastas das fatias baixadas) em
  tests/laboratorio/saida/varredura-logada.json e escreve o resumo (com a cobertura) no GITHUB_STEP_SUMMARY, quando
  existir, e na saída padrão. Nunca falha por achado: achado não é falha da spec.
  Uso: node scripts/lab/juntar-varredura-logada.mjs [pasta-raiz=tests/laboratorio/saida]
*/
import { appendFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { juntar, lerInventario, resumoMarkdown } from "../../tests/e2e/fixtures/e950-varredura.ts";

const raiz = process.argv[2] ?? "tests/laboratorio/saida";
const PASTA = "varredura-logada-e950";

/** Todas as parciais <persona>-<largura>.json debaixo da raiz (a pasta pode vir de várias fatias). */
function acharParciais(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) acharParciais(p, out);
    else if (dir.endsWith(PASTA) && /^[a-z-]+-(390|1280)\.json$/.test(nome)) out.push(p);
  }
  return out;
}

const parciais = acharParciais(raiz).map((p) => JSON.parse(readFileSync(p, "utf8")));
const inventario = lerInventario(readFileSync("docs/e793-painel-sessao-servidor.md", "utf8"));
const saida = juntar(parciais, inventario, new Date().toISOString());
mkdirSync("tests/laboratorio/saida", { recursive: true });
writeFileSync("tests/laboratorio/saida/varredura-logada.json", JSON.stringify(saida, null, 2));
const md = resumoMarkdown(saida);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
console.log(md);
console.log(`\n${parciais.length} parcial(is) juntada(s) → tests/laboratorio/saida/varredura-logada.json`);
