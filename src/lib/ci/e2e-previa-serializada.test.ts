/**
 * Serialização da prévia (DUET-RONDA-0700): as rodadas do "E2E da prévia" de PRs diferentes rodavam juntas, com as
 * MESMAS contas de teste e o MESMO banco, e esgotavam o limite de login ("Muitas tentativas" no global-setup).
 * O job da prévia entra numa fila única (um de cada vez, sem cancelar o que está rodando); a prova ao vivo de produção
 * fica fora dela (não usa as contas de teste da prévia).
 * Lê o yml como texto, recortando cada job (o mesmo jeito do e964-e2e-nunca-verde.test.ts) — sem dependência de YAML.
 * Roda: node --test src/lib/ci/e2e-previa-serializada.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const yml = readFileSync(".github/workflows/e2e.yml", "utf8");
const inicioJobs = yml.indexOf("\njobs:");
const topo = yml.slice(0, inicioJobs);
const jobE2e = yml.slice(yml.indexOf("\n  e2e:"), yml.indexOf("\n  prova-ao-vivo:"));
const jobProd = yml.slice(yml.indexOf("\n  prova-ao-vivo:"));

/** O bloco `concurrency:` no nível do job (4 espaços), com as linhas de 6 espaços que vêm logo abaixo. */
function concurrencyDoJob(job: string): string | null {
  const m = job.match(/\n {4}concurrency:\n((?: {6}.*\n)+)/);
  return m ? m[1] : null;
}

test("prévia: o job 'E2E da prévia' entra numa fila única, igual para todos os PRs (sem a URL do deploy no nome)", () => {
  const c = concurrencyDoJob(jobE2e);
  assert.ok(c, "o job e2e tem concurrency próprio");
  assert.match(c, /^ {6}group: e2e-previa-contas-de-teste$/m);
  assert.doesNotMatch(c, /\$\{\{/, "o grupo não depende do PR nem da URL");
});

test("prévia: a fila não derruba a rodada em andamento (cancel-in-progress: false)", () => {
  assert.match(concurrencyDoJob(jobE2e) ?? "", /^ {6}cancel-in-progress: false$/m);
});

test("produção: a prova ao vivo não entra na fila da prévia", () => {
  assert.doesNotMatch(jobProd, /e2e-previa-contas-de-teste/);
});

test("o mesmo deploy ainda cancela a rodada velha dele (o grupo do workflow por URL continua)", () => {
  assert.match(topo, /\nconcurrency:\n {2}group: e2e-\$\{\{ github\.event\.deployment_status\.target_url/);
});
