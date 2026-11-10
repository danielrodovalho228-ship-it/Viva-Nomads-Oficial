#!/usr/bin/env node
/*
  E775 — GATE DE MERGE PRÓPRIO (o repositório é de conta pessoal: a fila de merge nativa do GitHub só existe em repositório
  de organização). Responde, para um PR, "pode mesclar agora?" com a regra que a fila daria:
    1. o PR está aberto, fora do rascunho e aponta para a main;
    2. a branch CONTÉM a ponta atual da main (behind_by = 0) — assim o CI do head já testou a COMBINAÇÃO;
    3. cada check exigido (scripts/gate/exigidos.json) tem conclusão "success" NO HEAD do PR.
  Uso: GITHUB_TOKEN=... GITHUB_REPOSITORY=dono/repo node scripts/gate/pode-mesclar.mjs <número> [--com-suite]
  Sai com 0 (pode) ou 1 (não pode, com os motivos). Só lê; nunca mescla.
*/
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function avaliar({ pr, behindBy, checks, exigidos }) {
  const motivos = [];
  if (pr.state !== "open") motivos.push("o PR não está aberto");
  if (pr.draft) motivos.push("o PR está em rascunho");
  if (pr.base !== "main") motivos.push(`a base é ${pr.base}, não a main`);
  if (behindBy > 0) motivos.push(`a branch está ${behindBy} commit(s) atrás da main: atualize e espere o CI da combinação`);
  for (const nome of exigidos) {
    // vale o check mais recente com esse nome no head
    const doNome = checks.filter((c) => c.name === nome);
    const ultimo = doNome.sort((a, b) => String(b.started_at ?? "").localeCompare(String(a.started_at ?? "")))[0];
    if (!ultimo) motivos.push(`falta o check ${nome} no head`);
    else if (ultimo.status !== "completed") motivos.push(`o check ${nome} ainda não terminou`);
    else if (ultimo.conclusion !== "success") motivos.push(`o check ${nome} terminou em ${ultimo.conclusion}`);
  }
  return { pode: motivos.length === 0, motivos };
}

export function exigidosDe(config, comSuite) {
  return comSuite ? config.checksQuandoSuiteVerde : config.checks;
}

async function principal() {
  const [numero] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const comSuite = process.argv.includes("--com-suite");
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!numero || !repo || !token) {
    console.error("uso: GITHUB_TOKEN=... GITHUB_REPOSITORY=dono/repo node scripts/gate/pode-mesclar.mjs <PR> [--com-suite]");
    process.exit(2);
  }
  const api = async (caminho) => {
    const r = await fetch(`https://api.github.com/repos/${repo}${caminho}`, { headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" } });
    if (!r.ok) throw new Error(`${caminho}: ${r.status}`);
    return r.json();
  };
  const p = await api(`/pulls/${numero}`);
  const cmp = await api(`/compare/${p.base.ref}...${p.head.sha}`);
  const cr = await api(`/commits/${p.head.sha}/check-runs?per_page=100`);
  const config = JSON.parse(readFileSync(fileURLToPath(new URL("./exigidos.json", import.meta.url)), "utf8"));
  const r = avaliar({
    pr: { state: p.state, draft: p.draft, base: p.base.ref },
    behindBy: cmp.behind_by,
    checks: cr.check_runs,
    exigidos: exigidosDe(config, comSuite),
  });
  console.log(r.pode ? `PR #${numero}: PODE mesclar (head ${p.head.sha.slice(0, 7)})` : `PR #${numero}: NÃO pode mesclar:\n- ${r.motivos.join("\n- ")}`);
  process.exit(r.pode ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) principal().catch((e) => { console.error(e.message); process.exit(2); });
