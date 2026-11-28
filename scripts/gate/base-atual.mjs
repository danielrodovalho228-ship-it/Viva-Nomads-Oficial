/*
  E744, passo 5 (Família 9, segurança) — perna "base atual antes do merge" (desenho: docs/e775-desenho-fila-de-merge.md).
  O CI de um PR testa o PR contra a main de quando ele foi aberto ou atualizado: dois PRs verdes podem quebrar a main
  juntos. Este script grava em cada PR aberto para a main o status "base-atual":
    success = o branch contém a ponta da main: o CI dele vale para a main de agora;
    failure = está atrás da main: atualizar o branch e esperar o CI antes do merge.
  Dois momentos:
    • o PR foi aberto ou atualizado (--pr N): confere só ele, por uma comparação na API;
    • a main andou (--apos-merge): confere todos pelo git local, sem chamada por PR, e grava o status só nos que
      MUDAM — os que estavam em dia com a ponta anterior passam a vermelho; os que já estavam atrás ficam como estão.
      (Medido em 15/11: 1.035 PRs abertos para a main, 30 em dia. Uma comparação e um status por PR a cada merge
      estourariam o limite de chamadas do token do Actions.)
      PR que nunca recebeu status não ganha um aqui: recebe quando for atualizado (o evento do próprio PR).
  SÓ LÊ E AVISA: não mescla, não atualiza branch, não mexe em proteção.

  Uso: node scripts/gate/base-atual.mjs --repo dono/repo --pr N [--so-ler]
       node scripts/gate/base-atual.mjs --repo dono/repo --apos-merge --antes <sha> --ponta <sha> [--so-ler]
       (GITHUB_TOKEN no ambiente; --apos-merge roda num clone com o histórico da main)
*/
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { apiDoGitHub, argumentos } from "./api-github.mjs";

export const CONTEXTO = "base-atual";
/**
 * O texto do vermelho não leva número nem commit: quando a main anda de novo, os PRs que já estavam atrás não são
 * regravados, e um número ali ficaria velho. O verde diz a ponta que o branch contém.
 * @param {{ atras: number, pontaDaMain: string }} p
 */
export function veredito({ atras, pontaDaMain }) {
  if (atras === 0) return { state: "success", description: `Contém a ponta da main (${String(pontaDaMain).slice(0, 7)}).` };
  return { state: "failure", description: "Atrás da main: atualize o branch e espere o CI antes do merge." };
}

/** Só PR aberto cuja base é a main (rascunho também). @param {any[]} lista */
export function prsDaMain(lista) {
  return (lista ?? []).filter((p) => p?.state === "open" && p?.base?.ref === "main").map((p) => ({ numero: p.number, sha: p.head.sha }));
}

/**
 * O PR foi aberto ou atualizado: confere só ele, por uma comparação na API, e grava o status no commit de cabeça.
 * @param {{ api: import("./api-github.mjs").Api, repo: string, numero: number, soLer?: boolean }} o
 */
export async function conferirBases({ api, repo, numero, soLer = false }) {
  const prs = prsDaMain([await api("GET", `/repos/${repo}/pulls/${numero}`)]);
  const saida = [];
  for (const pr of prs) {
    // per_page=1: só interessam os contadores; sem isso a resposta traz até 250 commits.
    const c = await api("GET", `/repos/${repo}/compare/main...${pr.sha}?per_page=1`);
    const atras = Number(c.behind_by ?? 0);
    const v = veredito({ atras, pontaDaMain: c.base_commit?.sha ?? "" });
    saida.push({ numero: pr.numero, sha: pr.sha, atras, ...v, gravado: soLer ? false : await gravar({ api, repo, pr, v }) });
  }
  return saida;
}

/** Grava o status; PR de fork (token só de leitura) ou permissão faltando vira aviso no log, o job não cai. */
async function gravar({ api, repo, pr, v }) {
  try {
    await api("POST", `/repos/${repo}/statuses/${pr.sha}`, { state: v.state, context: CONTEXTO, description: v.description });
    return true;
  } catch (e) {
    console.log(`#${pr.numero}: não deu para gravar o status (${String(e instanceof Error ? e.message : e).slice(0, 120)})`);
    return false;
  }
}

/** @typedef {(args: string[]) => { status: number, stdout: string }} RodarGit */
/** @type {RodarGit} */
const gitDoSistema = (args) => {
  const r = spawnSync("git", args, { encoding: "utf8" });
  return { status: r.status ?? 1, stdout: r.stdout ?? "" };
};
const LOTE_DE_REFS = 40;

/**
 * A main andou de `antes` para `ponta`: busca as cabeças dos PRs abertos e decide pelo git local.
 *   contém a ponta nova                → success (grava);
 *   estava em dia com a ponta anterior → failure (grava: é quem muda);
 *   já estava atrás                    → fica como está (não grava).
 * @param {{ api: import("./api-github.mjs").Api, repo: string, antes?: string, ponta: string, soLer?: boolean, git?: RodarGit }} o
 */
export async function aposMerge({ api, repo, antes, ponta, soLer = false, git = gitDoSistema }) {
  const prs = [];
  for (let pagina = 1; ; pagina++) {
    const lote = await api("GET", `/repos/${repo}/pulls?state=open&base=main&per_page=100&page=${pagina}`);
    prs.push(...prsDaMain(lote));
    if (!Array.isArray(lote) || lote.length < 100) break;
  }
  const ref = (n) => `refs/remotes/pr/${n}`;
  for (let i = 0; i < prs.length; i += LOTE_DE_REFS) {
    git(["fetch", "--quiet", "--no-tags", "origin", ...prs.slice(i, i + LOTE_DE_REFS).map((p) => `+refs/pull/${p.numero}/head:${ref(p.numero)}`)]);
  }
  const contem = (commit, n) => git(["merge-base", "--is-ancestor", commit, ref(n)]).status === 0;
  // Ponta anterior ausente ou zerada (primeiro push, histórico reescrito): ninguém conta como "estava em dia".
  const antesValido = !!antes && !/^0+$/.test(antes);
  const saida = [];
  for (const pr of prs) {
    if (git(["rev-parse", "--verify", "--quiet", ref(pr.numero)]).status !== 0) {
      saida.push({ numero: pr.numero, sha: pr.sha, situacao: "sem-cabeca", gravado: false });
      continue;
    }
    const emDia = contem(ponta, pr.numero);
    const estavaEmDia = !emDia && antesValido && contem(antes, pr.numero);
    const situacao = emDia ? "em-dia" : estavaEmDia ? "ficou-atras" : "ja-estava-atras";
    const v = veredito({ atras: emDia ? 0 : 1, pontaDaMain: ponta });
    const deveGravar = !soLer && situacao !== "ja-estava-atras";
    saida.push({ numero: pr.numero, sha: pr.sha, situacao, ...v, gravado: deveGravar ? await gravar({ api, repo, pr, v }) : false });
  }
  return saida;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const a = argumentos(process.argv.slice(2));
  const uso = () => {
    console.error("uso: node scripts/gate/base-atual.mjs --repo dono/repo --pr N [--so-ler]\n     node scripts/gate/base-atual.mjs --repo dono/repo --apos-merge --antes <sha> --ponta <sha> [--so-ler]");
    process.exit(2);
  };
  if (typeof a.repo !== "string") uso();
  const api = apiDoGitHub(process.env.GITHUB_TOKEN);
  const soLer = a["so-ler"] === true;
  if (a["apos-merge"] === true) {
    if (typeof a.ponta !== "string") uso();
    const lista = await aposMerge({ api, repo: String(a.repo), antes: typeof a.antes === "string" ? a.antes : undefined, ponta: String(a.ponta), soLer });
    const n = (s) => lista.filter((l) => l.situacao === s).length;
    console.log(`### Base atual depois de a main andar para ${String(a.ponta).slice(0, 7)}\n`);
    console.log(`PRs abertos para a main: ${lista.length} · em dia: ${n("em-dia")} · ficaram atrás agora: ${n("ficou-atras")} · já estavam atrás: ${n("ja-estava-atras")} · status gravados: ${lista.filter((l) => l.gravado).length}\n`);
    const mudaram = lista.filter((l) => l.situacao === "ficou-atras");
    if (mudaram.length) console.log(`Passaram a vermelho: ${mudaram.map((l) => `#${l.numero}`).join(", ")}`);
  } else {
    if (typeof a.pr !== "string") uso();
    const lista = await conferirBases({ api, repo: String(a.repo), numero: Number(a.pr), soLer });
    console.log("### Base atual\n");
    for (const l of lista) console.log(`#${l.numero}: ${l.state === "success" ? "✅" : "❌"} ${l.description}${l.atras ? ` (${l.atras} commit${l.atras === 1 ? "" : "s"} atrás)` : ""}${l.gravado ? "" : " — status não gravado"}`);
    if (!lista.length) console.log("Este PR não é para a main: sem status.");
  }
}
