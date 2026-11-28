/*
  E744, passo 5 — as duas pernas de segurança da Família 9 que faltavam (desenho em docs/e775-desenho-fila-de-merge.md):
   1. BASE ATUAL: todo PR aberto para a main leva o status "base-atual" — verde só quando o branch contém a ponta da
      main. É recalculado a cada atualização do PR e a cada merge na main (quando a main anda, os outros PRs ficam
      vermelhos até serem atualizados). Regra do E775: quem pousa na main já foi testado com a ponta da main dentro.
   2. MAIN VERMELHA: quando o verify ou o lab-crítico da main falha depois de um merge, abre-se um aviso (issue) que
      diz o commit, o PR que entrou e o run; o aviso fecha sozinho quando os dois voltam a verde. Regra do E775:
      main vermelha pausa os merges.
  As duas só leem e avisam: nada aqui mescla, atualiza branch ou muda proteção.
  Roda: npm test
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONTEXTO, aposMerge, conferirBases, prsDaMain, veredito } from "../../scripts/gate/base-atual.mjs";
import { PREFIXO_TITULO, WORKFLOWS_DA_MAIN, acaoDaMain, avisarDaMain, prDoCommit, textoDoAviso } from "../../scripts/gate/main-vermelha.mjs";

type Chamada = { metodo: string; caminho: string; corpo?: unknown };
/** API falsa: responde pelo par "MÉTODO caminho" e guarda o que foi chamado. */
function apiFalsa(respostas: Record<string, unknown>) {
  const chamadas: Chamada[] = [];
  const api = async (metodo: string, caminho: string, corpo?: unknown) => {
    chamadas.push({ metodo, caminho, corpo });
    const chave = `${metodo} ${caminho}`;
    if (!(chave in respostas)) throw new Error(`API falsa sem resposta para: ${chave}`);
    const r = respostas[chave];
    if (r instanceof Error) throw r;
    return r;
  };
  return { api, chamadas };
}
const PONTA = "a".repeat(40);

test("base atual: verde só com zero commit atrás; o vermelho diz o que fazer, sem número que fique velho", () => {
  assert.equal(CONTEXTO, "base-atual");
  assert.deepEqual(veredito({ atras: 0, pontaDaMain: PONTA }), { state: "success", description: "Contém a ponta da main (aaaaaaa)." });
  const atras = { state: "failure", description: "Atrás da main: atualize o branch e espere o CI antes do merge." };
  assert.deepEqual(veredito({ atras: 1, pontaDaMain: PONTA }), atras);
  assert.deepEqual(veredito({ atras: 123456, pontaDaMain: PONTA }), atras);
  assert.ok(atras.description.length <= 140, "limite do texto de status do GitHub");
});

test("base atual: só PR aberto para a main entra (rascunho também: a cadeia de merges é feita de rascunhos)", () => {
  const lista = [
    { number: 1, state: "open", draft: true, base: { ref: "main" }, head: { sha: "s1" } },
    { number: 2, state: "open", draft: false, base: { ref: "main" }, head: { sha: "s2" } },
    { number: 3, state: "open", draft: false, base: { ref: "claude-b/outro" }, head: { sha: "s3" } },
    { number: 4, state: "closed", draft: false, base: { ref: "main" }, head: { sha: "s4" } },
  ];
  assert.deepEqual(prsDaMain(lista), [{ numero: 1, sha: "s1" }, { numero: 2, sha: "s2" }]);
});

test("base atual, PR aberto ou atualizado: uma comparação na API e o status no commit de cabeça", async () => {
  const pr = (base = "main") => ({ number: 9, state: "open", draft: true, base: { ref: base }, head: { sha: "c9" } });
  const atras = apiFalsa({
    "GET /repos/o/r/pulls/9": pr(),
    "GET /repos/o/r/compare/main...c9?per_page=1": { behind_by: 3, base_commit: { sha: PONTA } },
    "POST /repos/o/r/statuses/c9": {},
  });
  assert.deepEqual((await conferirBases({ api: atras.api, repo: "o/r", numero: 9 })).map((x) => [x.numero, x.atras, x.state, x.gravado]), [[9, 3, "failure", true]]);
  assert.deepEqual(atras.chamadas.at(-1), { metodo: "POST", caminho: "/repos/o/r/statuses/c9", corpo: { state: "failure", context: "base-atual", description: "Atrás da main: atualize o branch e espere o CI antes do merge." } });

  const emDia = apiFalsa({ "GET /repos/o/r/pulls/9": pr(), "GET /repos/o/r/compare/main...c9?per_page=1": { behind_by: 0, base_commit: { sha: PONTA } }, "POST /repos/o/r/statuses/c9": {} });
  await conferirBases({ api: emDia.api, repo: "o/r", numero: 9 });
  assert.deepEqual(emDia.chamadas.at(-1)!.corpo, { state: "success", context: "base-atual", description: "Contém a ponta da main (aaaaaaa)." });

  // Sem permissão de gravar (PR de fork): o job não cai. --so-ler não grava. PR empilhado (outra base) não recebe status.
  const semPermissao = apiFalsa({ "GET /repos/o/r/pulls/9": pr(), "GET /repos/o/r/compare/main...c9?per_page=1": { behind_by: 2, base_commit: { sha: PONTA } }, "POST /repos/o/r/statuses/c9": new Error("403 Resource not accessible by integration") });
  assert.deepEqual((await conferirBases({ api: semPermissao.api, repo: "o/r", numero: 9 })).map((x) => [x.atras, x.gravado]), [[2, false]]);
  const soLer = apiFalsa({ "GET /repos/o/r/pulls/9": pr(), "GET /repos/o/r/compare/main...c9?per_page=1": { behind_by: 0, base_commit: { sha: PONTA } } });
  await conferirBases({ api: soLer.api, repo: "o/r", numero: 9, soLer: true });
  assert.equal(soLer.chamadas.filter((c) => c.metodo !== "GET").length, 0);
  const empilhado = apiFalsa({ "GET /repos/o/r/pulls/9": pr("claude-b/x") });
  assert.deepEqual(await conferirBases({ api: empilhado.api, repo: "o/r", numero: 9 }), []);
});

/** git falso: `contem[n]` lista os commits da main que a cabeça do PR n contém; guarda os comandos. */
function gitFalso(contem: Record<number, string[]>, semCabeca: number[] = []) {
  const comandos: string[][] = [];
  const git = (args: string[]) => {
    comandos.push(args);
    const n = Number((/refs\/remotes\/pr\/(\d+)$/.exec(args.at(-1) ?? "") ?? [])[1]);
    if (args[0] === "fetch") return { status: 0, stdout: "" };
    if (args[0] === "rev-parse") return { status: semCabeca.includes(n) ? 1 : 0, stdout: "" };
    if (args[0] === "merge-base") return { status: (contem[n] ?? []).includes(args[2]) ? 0 : 1, stdout: "" };
    throw new Error(`git falso sem resposta: ${args.join(" ")}`);
  };
  return { git, comandos };
}
const ANTES = "b".repeat(40);
const abertos = (ns: number[]) => ns.map((n) => ({ number: n, state: "open", draft: true, base: { ref: "main" }, head: { sha: `c${n}` } }));

test("base atual, a main andou: pelo git local, grava só em quem muda (estava em dia → vermelho; em dia → verde)", async () => {
  const { api, chamadas } = apiFalsa({
    "GET /repos/o/r/pulls?state=open&base=main&per_page=100&page=1": abertos([1, 2, 3, 4]),
    "POST /repos/o/r/statuses/c1": {},
    "POST /repos/o/r/statuses/c2": {},
  });
  // #1 contém a ponta nova; #2 estava em dia com a ponta anterior; #3 já estava atrás; #4 não tem cabeça para buscar.
  const { git, comandos } = gitFalso({ 1: [ANTES, PONTA], 2: [ANTES], 3: [] }, [4]);
  const r = await aposMerge({ api, repo: "o/r", antes: ANTES, ponta: PONTA, git });
  assert.deepEqual(r.map((x) => [x.numero, x.situacao, x.gravado]), [[1, "em-dia", true], [2, "ficou-atras", true], [3, "ja-estava-atras", false], [4, "sem-cabeca", false]]);
  const gravados = chamadas.filter((c) => c.metodo === "POST");
  assert.deepEqual(gravados.map((c) => [c.caminho, (c.corpo as { state: string }).state]), [["/repos/o/r/statuses/c1", "success"], ["/repos/o/r/statuses/c2", "failure"]]);
  // Nenhuma comparação por PR na API: uma listagem e uma busca de cabeças só.
  assert.deepEqual(chamadas.filter((c) => c.metodo === "GET").map((c) => c.caminho), ["/repos/o/r/pulls?state=open&base=main&per_page=100&page=1"]);
  assert.deepEqual(comandos[0], ["fetch", "--quiet", "--no-tags", "origin", "+refs/pull/1/head:refs/remotes/pr/1", "+refs/pull/2/head:refs/remotes/pr/2", "+refs/pull/3/head:refs/remotes/pr/3", "+refs/pull/4/head:refs/remotes/pr/4"]);
  assert.ok(comandos.every((c) => ["fetch", "rev-parse", "merge-base"].includes(c[0])), "o git só busca e compara; nunca empurra, mescla ou apaga");
});

test("base atual, a main andou: sem ponta anterior ninguém 'estava em dia'; --so-ler não grava", async () => {
  const lista = { "GET /repos/o/r/pulls?state=open&base=main&per_page=100&page=1": abertos([2, 3]) };
  const semAntes = apiFalsa(lista);
  const zerada = await aposMerge({ api: semAntes.api, repo: "o/r", antes: "0".repeat(40), ponta: PONTA, git: gitFalso({ 2: ["0".repeat(40)], 3: [] }).git });
  assert.deepEqual(zerada.map((x) => [x.numero, x.situacao, x.gravado]), [[2, "ja-estava-atras", false], [3, "ja-estava-atras", false]]);

  const soLer = apiFalsa(lista);
  await aposMerge({ api: soLer.api, repo: "o/r", antes: ANTES, ponta: PONTA, soLer: true, git: gitFalso({ 2: [ANTES], 3: [] }).git });
  assert.equal(soLer.chamadas.filter((c) => c.metodo !== "GET").length, 0);
});

test("main vermelha: qual PR entrou, pelo texto do commit de merge", () => {
  assert.equal(prDoCommit("Merge pull request #3833 from danielrodovalho228-ship-it/claude-b/e931-buscar-sem-flutuante\n\nfix(E931)"), 3833);
  assert.equal(prDoCommit("fix: algo direto na main"), null);
  assert.equal(prDoCommit(""), null);
});

test("main vermelha: falhou abre (ou comenta no aviso aberto); voltou a verde nos dois fecha; o resto não faz nada", () => {
  assert.equal(acaoDaMain({ conclusao: "failure", avisoAberto: false, todosVerdes: false }), "abrir");
  assert.equal(acaoDaMain({ conclusao: "failure", avisoAberto: true, todosVerdes: false }), "comentar");
  assert.equal(acaoDaMain({ conclusao: "success", avisoAberto: true, todosVerdes: true }), "fechar");
  assert.equal(acaoDaMain({ conclusao: "success", avisoAberto: true, todosVerdes: false }), "nada", "um verde e o outro ainda vermelho: o aviso fica");
  assert.equal(acaoDaMain({ conclusao: "success", avisoAberto: false, todosVerdes: true }), "nada");
  assert.equal(acaoDaMain({ conclusao: "cancelled", avisoAberto: false, todosVerdes: false }), "nada", "run cancelado não é main vermelha");
  assert.equal(acaoDaMain({ conclusao: "timed_out", avisoAberto: false, todosVerdes: false }), "abrir", "estouro de tempo conta como falha");
});

test("main vermelha: o aviso diz o commit, o PR que entrou, o run e a regra", () => {
  const t = textoDoAviso({ workflow: "Lab crítico (fluxos críticos)", sha: PONTA, mensagem: "Merge pull request #3831 from x/y\n\nfix", urlDoRun: "https://github.com/o/r/actions/runs/1" });
  assert.equal(t.title, "Main vermelha desde aaaaaaa (Lab crítico (fluxos críticos))");
  assert.ok(t.title.startsWith(PREFIXO_TITULO));
  assert.match(t.body, /#3831/);
  assert.match(t.body, /https:\/\/github\.com\/o\/r\/actions\/runs\/1/);
  assert.match(t.body, /nenhum PR entra enquanto a main estiver vermelha, salvo o que a conserta/);
});

test("main vermelha: abre o aviso na falha e fecha quando verify e lab-crítico da main estão verdes", async () => {
  assert.deepEqual(WORKFLOWS_DA_MAIN, ["ci.yml", "lab-critico.yml"]);
  const run = (conclusao: string) => ({ name: "CI", conclusion: conclusao, head_sha: PONTA, html_url: "https://github.com/o/r/actions/runs/1", head_commit: { message: "Merge pull request #5 from a/b" } });
  const abrir = apiFalsa({ "GET /repos/o/r/issues?state=open&creator=github-actions%5Bbot%5D&per_page=100&page=1": [{ number: 1, title: "outra coisa" }], "POST /repos/o/r/issues": { number: 77 } });
  assert.deepEqual(await avisarDaMain({ api: abrir.api, repo: "o/r", run: run("failure") }), { acao: "abrir", aviso: 77 });
  assert.equal((abrir.chamadas.at(-1)!.corpo as { title: string }).title, "Main vermelha desde aaaaaaa (CI)");

  const verde = { workflow_runs: [{ status: "completed", conclusion: "success", head_sha: PONTA }] };
  const fechar = apiFalsa({
    "GET /repos/o/r/issues?state=open&creator=github-actions%5Bbot%5D&per_page=100&page=1": [{ number: 77, title: "Main vermelha desde bbbbbbb (CI)" }, { number: 78, title: "PR disfarçado", pull_request: {} }],
    "GET /repos/o/r/actions/workflows/ci.yml/runs?branch=main&event=push&status=completed&per_page=1": verde,
    "GET /repos/o/r/actions/workflows/lab-critico.yml/runs?branch=main&event=push&status=completed&per_page=1": verde,
    "POST /repos/o/r/issues/77/comments": {},
    "PATCH /repos/o/r/issues/77": {},
  });
  assert.deepEqual(await avisarDaMain({ api: fechar.api, repo: "o/r", run: run("success") }), { acao: "fechar", aviso: 77 });
  assert.deepEqual(fechar.chamadas.at(-1), { metodo: "PATCH", caminho: "/repos/o/r/issues/77", corpo: { state: "closed", state_reason: "completed" } });

  const aindaVermelho = apiFalsa({
    "GET /repos/o/r/issues?state=open&creator=github-actions%5Bbot%5D&per_page=100&page=1": [{ number: 77, title: "Main vermelha desde bbbbbbb (CI)" }],
    "GET /repos/o/r/actions/workflows/ci.yml/runs?branch=main&event=push&status=completed&per_page=1": verde,
    "GET /repos/o/r/actions/workflows/lab-critico.yml/runs?branch=main&event=push&status=completed&per_page=1": { workflow_runs: [{ status: "completed", conclusion: "failure", head_sha: PONTA }] },
  });
  assert.deepEqual(await avisarDaMain({ api: aindaVermelho.api, repo: "o/r", run: run("success") }), { acao: "nada", aviso: 77 });
});

test("travas: os dois scripts só leem e avisam — nada mescla, atualiza branch ou mexe em proteção", () => {
  for (const f of ["scripts/gate/base-atual.mjs", "scripts/gate/main-vermelha.mjs"]) {
    const s = readFileSync(f, "utf8");
    assert.doesNotMatch(s, /\/merge\b|update-branch|\/protection|\/rulesets|"PUT"|"DELETE"/, f);
  }
  const base = readFileSync("scripts/gate/base-atual.mjs", "utf8");
  assert.deepEqual([...new Set([...base.matchAll(/"(POST|PATCH)"/g)].map((m) => m[1]))], ["POST"], "a única escrita é o status do commit");
});

test("workflow: gatilhos, permissão mínima por job e nada de pull_request_target", () => {
  const w = readFileSync(".github/workflows/seguranca-do-merge.yml", "utf8");
  assert.doesNotMatch(w, /pull_request_target|workflow_dispatch/, "sem disparo manual: gravar em todos os PRs abertos (mais de mil) estouraria o limite de chamadas");
  assert.match(w, /\non:\n  pull_request:\n    types: \[opened, reopened, synchronize, ready_for_review\]\n  push:\n    branches: \[main\]\n  workflow_run:\n    workflows: \["CI", "Lab crítico \(fluxos críticos\)"\]\n    types: \[completed\]\n    branches: \[main\]\n\npermissions:/);
  assert.match(w, /\npermissions:\n  contents: read\n/, "o padrão do workflow é só leitura");
  const jobBase = w.slice(w.indexOf("  conferir-base:"), w.indexOf("  main-vermelha:"));
  const jobMain = w.slice(w.indexOf("  main-vermelha:"));
  assert.match(jobBase, /if: github\.event_name != 'workflow_run'/);
  assert.match(jobBase, /permissions:\n      contents: read\n      pull-requests: read\n      statuses: write\n/);
  assert.doesNotMatch(jobBase, /issues: write|contents: write|actions:/);
  // Quando a main anda, o job precisa do histórico da main para comparar no git local.
  assert.match(jobBase, /fetch-depth: \$\{\{ github\.event_name == 'pull_request' && 1 \|\| 0 \}\}/);
  assert.match(jobBase, /--apos-merge --antes "\$ANTES" --ponta "\$PONTA"/);
  // Cada push da main tem o seu run (nenhum é cancelado): quem estava em dia com a ponta anterior precisa virar vermelho.
  assert.match(jobBase, /group: conferir-base-\$\{\{ github\.event\.pull_request\.number \|\| github\.sha \}\}/);
  assert.match(jobMain, /if: github\.event_name == 'workflow_run' && github\.event\.workflow_run\.event == 'push'/);
  assert.match(jobMain, /permissions:\n      contents: read\n      actions: read\n      issues: write\n/);
  assert.doesNotMatch(jobMain, /statuses: write|contents: write|pull-requests: write/);
  // Os nomes dos workflows observados são os da main (se mudarem lá, o gatilho deixa de disparar).
  assert.match(readFileSync(".github/workflows/ci.yml", "utf8"), /^name: CI$/m);
  assert.match(readFileSync(".github/workflows/lab-critico.yml", "utf8"), /^name: Lab crítico \(fluxos críticos\)$/m);
  // Dado do evento entra por variável de ambiente, nunca colado no comando.
  assert.doesNotMatch(w, /run:[^\n]*\$\{\{ *github\.event/);
  const script = jobBase.slice(jobBase.indexOf("run: |"));
  assert.ok(script.includes("base-atual.mjs"), "o script do passo foi lido");
  assert.doesNotMatch(script, /\$\{\{/, "nenhuma expressão dentro do script do passo");
});
