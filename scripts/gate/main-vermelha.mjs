/*
  E744, passo 5 (Família 9, segurança) — perna "detector no caminho do merge" (desenho: docs/e775-desenho-fila-de-merge.md).
  O detector de verde que vira vermelho só vivia na rodada noturna. A cada merge a main já roda o verify (CI) e o
  lab-crítico; quando um deles FALHA, este script abre um aviso (issue "Main vermelha desde <commit>") com o commit, o
  PR que entrou e o run. Outra falha com o aviso aberto vira comentário nele. Quando os dois voltam a verde na main, o
  aviso é fechado. Regra 2 do E775: nenhum PR entra enquanto a main estiver vermelha, salvo o que a conserta.
  SÓ LÊ E AVISA: não mescla, não reverte, não mexe em proteção.

  Uso (no workflow, a cada verify/lab-crítico concluído na main; GITHUB_TOKEN e os dados do run no ambiente):
    node scripts/gate/main-vermelha.mjs --repo dono/repo
      RUN_NOME, RUN_CONCLUSAO, RUN_SHA, RUN_URL, RUN_MENSAGEM
*/
import { pathToFileURL } from "node:url";
import { apiDoGitHub, argumentos } from "./api-github.mjs";

export const PREFIXO_TITULO = "Main vermelha";
/** Os workflows que rodam a cada merge na main (arquivo em .github/workflows). */
export const WORKFLOWS_DA_MAIN = ["ci.yml", "lab-critico.yml"];
/** Quem abre o aviso: o token do Actions (github-actions[bot]), já codificado para a URL. */
const AUTOR_DO_AVISO = encodeURIComponent("github-actions[bot]");
const FALHAS = new Set(["failure", "timed_out", "startup_failure"]);

/** Número do PR no texto do commit de merge ("Merge pull request #123 from …"), ou null. */
export function prDoCommit(mensagem) {
  const m = /^Merge pull request #(\d+)\b/.exec(String(mensagem ?? ""));
  return m ? Number(m[1]) : null;
}

/** @param {{ conclusao: string, avisoAberto: boolean, todosVerdes: boolean }} p @returns {"abrir" | "comentar" | "fechar" | "nada"} */
export function acaoDaMain({ conclusao, avisoAberto, todosVerdes }) {
  if (FALHAS.has(conclusao)) return avisoAberto ? "comentar" : "abrir";
  if (conclusao === "success" && avisoAberto && todosVerdes) return "fechar";
  return "nada";
}

/** @param {{ workflow: string, sha: string, mensagem: string, urlDoRun: string }} p */
export function textoDoAviso({ workflow, sha, mensagem, urlDoRun }) {
  const pr = prDoCommit(mensagem);
  const titulo = String(mensagem ?? "").split("\n")[0].slice(0, 120);
  return {
    title: `${PREFIXO_TITULO} desde ${String(sha).slice(0, 7)} (${workflow})`,
    body: [
      `O **${workflow}** falhou na main depois deste commit.`,
      "",
      `- Commit: ${sha}${titulo ? ` — ${titulo}` : ""}`,
      `- PR que entrou: ${pr ? `#${pr}` : "não identificado (commit sem \"Merge pull request #N\")"}`,
      `- Run: ${urlDoRun}`,
      "",
      "Regra (E775, regra 2): nenhum PR entra enquanto a main estiver vermelha, salvo o que a conserta.",
      "Este aviso fecha sozinho quando o verify e o lab-crítico da main voltarem a verde.",
    ].join("\n"),
  };
}

/**
 * @param {{ api: import("./api-github.mjs").Api, repo: string, run: { name: string, conclusion: string, head_sha: string, html_url: string, head_commit?: { message?: string } } }} o
 */
export async function avisarDaMain({ api, repo, run }) {
  // Só as issues abertas pelo próprio Actions (quem abre o aviso): a listagem geral traz também os PRs, e há mais de
  // mil abertos. A chave pull_request marca PR; fica de fora.
  let aviso;
  for (let pagina = 1; !aviso; pagina++) {
    const lote = await api("GET", `/repos/${repo}/issues?state=open&creator=${AUTOR_DO_AVISO}&per_page=100&page=${pagina}`);
    aviso = (lote ?? []).find((i) => !i.pull_request && String(i.title ?? "").startsWith(PREFIXO_TITULO));
    if (!Array.isArray(lote) || lote.length < 100) break;
  }
  let todosVerdes = false;
  if (run.conclusion === "success" && aviso) {
    todosVerdes = true;
    for (const w of WORKFLOWS_DA_MAIN) {
      const r = await api("GET", `/repos/${repo}/actions/workflows/${w}/runs?branch=main&event=push&status=completed&per_page=1`);
      if (r?.workflow_runs?.[0]?.conclusion !== "success") todosVerdes = false;
    }
  }
  const acao = acaoDaMain({ conclusao: run.conclusion, avisoAberto: !!aviso, todosVerdes });
  const texto = textoDoAviso({ workflow: run.name, sha: run.head_sha, mensagem: run.head_commit?.message ?? "", urlDoRun: run.html_url });
  if (acao === "abrir") {
    const nova = await api("POST", `/repos/${repo}/issues`, texto);
    return { acao, aviso: nova.number };
  }
  if (acao === "comentar") {
    await api("POST", `/repos/${repo}/issues/${aviso.number}/comments`, { body: `Outra falha na main.\n\n${texto.body}` });
    return { acao, aviso: aviso.number };
  }
  if (acao === "fechar") {
    await api("POST", `/repos/${repo}/issues/${aviso.number}/comments`, { body: `A main voltou a verde em ${run.head_sha} (verify e lab-crítico).` });
    await api("PATCH", `/repos/${repo}/issues/${aviso.number}`, { state: "closed", state_reason: "completed" });
    return { acao, aviso: aviso.number };
  }
  return { acao, aviso: aviso?.number ?? null };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const a = argumentos(process.argv.slice(2));
  const e = process.env;
  if (typeof a.repo !== "string" || !e.RUN_CONCLUSAO || !e.RUN_SHA) {
    console.error("uso: node scripts/gate/main-vermelha.mjs --repo dono/repo   (RUN_NOME, RUN_CONCLUSAO, RUN_SHA, RUN_URL, RUN_MENSAGEM no ambiente)");
    process.exit(2);
  }
  const r = await avisarDaMain({
    api: apiDoGitHub(e.GITHUB_TOKEN),
    repo: a.repo,
    run: { name: e.RUN_NOME ?? "", conclusion: e.RUN_CONCLUSAO, head_sha: e.RUN_SHA, html_url: e.RUN_URL ?? "", head_commit: { message: e.RUN_MENSAGEM ?? "" } },
  });
  console.log(`### Main: ${e.RUN_NOME} → ${e.RUN_CONCLUSAO} em ${e.RUN_SHA.slice(0, 7)}\n\nAção: ${r.acao}${r.aviso ? ` (aviso #${r.aviso})` : ""}`);
}
