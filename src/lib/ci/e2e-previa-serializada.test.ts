/**
 * Serialização da prévia (DUET-RONDA-0700): as rodadas do "E2E da prévia" de PRs diferentes rodavam juntas, com as
 * MESMAS contas de teste e o MESMO banco, e esgotavam o limite de login ("Muitas tentativas" no global-setup).
 * O job da prévia entra numa fila única (um de cada vez, sem cancelar o que está rodando); a prova ao vivo de produção
 * fica fora dela (não usa as contas de teste da prévia).
 * Roda: node --test src/lib/ci/e2e-previa-serializada.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";

type Job = { concurrency?: string | { group?: string; "cancel-in-progress"?: boolean | string } };
const wf = yaml.load(readFileSync(".github/workflows/e2e.yml", "utf8")) as { concurrency?: { group?: string }; jobs: Record<string, Job> };

const grupo = (c: Job["concurrency"]) => (typeof c === "string" ? c : c?.group);

test("prévia: o job 'E2E da prévia' entra numa fila única, igual para todos os PRs (sem a URL do deploy no nome)", () => {
  const c = wf.jobs.e2e.concurrency;
  assert.ok(c, "o job e2e tem concurrency próprio");
  const g = grupo(c);
  assert.equal(g, "e2e-previa-contas-de-teste");
  assert.doesNotMatch(String(g), /\$\{\{/, "o grupo não depende do PR nem da URL");
});

test("prévia: a fila não derruba a rodada em andamento (cancel-in-progress: false)", () => {
  const c = wf.jobs.e2e.concurrency;
  assert.equal(typeof c === "object" ? c["cancel-in-progress"] : undefined, false);
});

test("produção: a prova ao vivo não entra na fila da prévia", () => {
  assert.notEqual(grupo(wf.jobs["prova-ao-vivo"].concurrency), "e2e-previa-contas-de-teste");
});

test("o mesmo deploy ainda cancela a rodada velha dele (o grupo do workflow por URL continua)", () => {
  assert.match(String(wf.concurrency?.group), /deployment_status\.target_url/);
});
