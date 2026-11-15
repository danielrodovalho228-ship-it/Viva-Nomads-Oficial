/*
  E744, passo 5 (Família 9, segurança) — perna "base atual antes do merge" (desenho: docs/e775-desenho-fila-de-merge.md).
  O CI de um PR testa o PR contra a main de quando ele foi aberto ou atualizado: dois PRs verdes podem quebrar a main
  juntos. Este script grava em cada PR aberto para a main o status "base-atual":
    success = o branch contém a ponta da main (zero commit atrás): o CI dele vale para a main de agora;
    failure = N commits atrás: atualizar o branch e esperar o CI antes do merge.
  Roda a cada atualização do PR (só ele) e a cada merge na main (todos os abertos: quando a main anda, os outros ficam
  vermelhos até serem atualizados). SÓ LÊ E AVISA: não mescla, não atualiza branch, não mexe em proteção.

  Uso: node scripts/gate/base-atual.mjs --repo dono/repo [--pr N] [--so-ler]      (GITHUB_TOKEN no ambiente)
*/
import { pathToFileURL } from "node:url";
import { apiDoGitHub, argumentos } from "./api-github.mjs";

export const CONTEXTO = "base-atual";
const LIMITE_DESCRICAO = 140; // limite do texto de um status de commit no GitHub

/** @param {{ atras: number, pontaDaMain: string }} p */
export function veredito({ atras, pontaDaMain }) {
  const ponta = String(pontaDaMain).slice(0, 7);
  if (atras === 0) return { state: "success", description: `Contém a ponta da main (${ponta}).` };
  const texto = `${atras} commit${atras === 1 ? "" : "s"} atrás da main (${ponta}): atualize o branch e espere o CI antes do merge.`;
  return { state: "failure", description: texto.slice(0, LIMITE_DESCRICAO) };
}

/** Só PR aberto cuja base é a main (rascunho também). @param {any[]} lista */
export function prsDaMain(lista) {
  return (lista ?? []).filter((p) => p?.state === "open" && p?.base?.ref === "main").map((p) => ({ numero: p.number, sha: p.head.sha }));
}

/**
 * Confere um PR (numero) ou todos os abertos para a main e grava o status em cada commit de cabeça.
 * @param {{ api: import("./api-github.mjs").Api, repo: string, numero?: number, soLer?: boolean }} o
 */
export async function conferirBases({ api, repo, numero, soLer = false }) {
  let prs;
  if (numero) prs = prsDaMain([await api("GET", `/repos/${repo}/pulls/${numero}`)]);
  else {
    prs = [];
    for (let pagina = 1; ; pagina++) {
      const lote = await api("GET", `/repos/${repo}/pulls?state=open&base=main&per_page=100&page=${pagina}`);
      prs.push(...prsDaMain(lote));
      if (!Array.isArray(lote) || lote.length < 100) break;
    }
  }
  const saida = [];
  for (const pr of prs) {
    const c = await api("GET", `/repos/${repo}/compare/main...${pr.sha}`);
    const v = veredito({ atras: Number(c.behind_by ?? 0), pontaDaMain: c.base_commit?.sha ?? "" });
    let gravado = false;
    if (!soLer) {
      try {
        await api("POST", `/repos/${repo}/statuses/${pr.sha}`, { state: v.state, context: CONTEXTO, description: v.description });
        gravado = true;
      } catch (e) {
        // PR de fork (token só de leitura) ou permissão faltando: o aviso fica no log, o job não cai.
        console.log(`#${pr.numero}: não deu para gravar o status (${String(e instanceof Error ? e.message : e).slice(0, 120)})`);
      }
    }
    saida.push({ numero: pr.numero, sha: pr.sha, atras: Number(c.behind_by ?? 0), state: v.state, description: v.description, gravado });
  }
  return saida;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const a = argumentos(process.argv.slice(2));
  if (typeof a.repo !== "string") {
    console.error("uso: node scripts/gate/base-atual.mjs --repo dono/repo [--pr N] [--so-ler]");
    process.exit(2);
  }
  const lista = await conferirBases({ api: apiDoGitHub(process.env.GITHUB_TOKEN), repo: a.repo, numero: typeof a.pr === "string" ? Number(a.pr) : undefined, soLer: a["so-ler"] === true });
  console.log("### Base atual (PRs abertos para a main)\n");
  console.log("| PR | Atrás da main | Status |\n|---|---|---|");
  for (const l of lista) console.log(`| #${l.numero} | ${l.atras} | ${l.state === "success" ? "✅" : "❌"} ${l.description}${l.gravado ? "" : " (não gravado)"} |`);
  if (!lista.length) console.log("| — | — | nenhum PR aberto para a main |");
}
