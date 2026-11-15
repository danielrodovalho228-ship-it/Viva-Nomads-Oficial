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
import { CONTEXTO, conferirBases, prsDaMain, veredito } from "../../scripts/gate/base-atual.mjs";
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

test("base atual: verde só com zero commit atrás; o texto diz a ponta da main e o que fazer", () => {
  assert.equal(CONTEXTO, "base-atual");
  assert.deepEqual(veredito({ atras: 0, pontaDaMain: PONTA }), { state: "success", description: "Contém a ponta da main (aaaaaaa)." });
  const um = veredito({ atras: 1, pontaDaMain: PONTA });
  assert.equal(um.state, "failure");
  assert.equal(um.description, "1 commit atrás da main (aaaaaaa): atualize o branch e espere o CI antes do merge.");
  assert.match(veredito({ atras: 12, pontaDaMain: PONTA }).description, /^12 commits atrás da main/);
  assert.ok(veredito({ atras: 123456, pontaDaMain: PONTA }).description.length <= 140, "limite do texto de status do GitHub");
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

test("base atual: confere cada PR pela comparação com a main e grava o status no commit de cabeça", async () => {
  const { api, chamadas } = apiFalsa({
    "GET /repos/o/r/pulls?state=open&base=main&per_page=100&page=1": [
      { number: 7, state: "open", draft: true, base: { ref: "main" }, head: { sha: "c7" } },
      { number: 8, state: "open", draft: true, base: { ref: "main" }, head: { sha: "c8" } },
    ],
    "GET /repos/o/r/compare/main...c7": { behind_by: 0, base_commit: { sha: PONTA } },
    "GET /repos/o/r/compare/main...c8": { behind_by: 3, base_commit: { sha: PONTA } },
    "POST /repos/o/r/statuses/c7": {},
    "POST /repos/o/r/statuses/c8": {},
  });
  const r = await conferirBases({ api, repo: "o/r" });
  assert.deepEqual(r.map((x) => [x.numero, x.atras, x.state, x.gravado]), [[7, 0, "success", true], [8, 3, "failure", true]]);
  const gravados = chamadas.filter((c) => c.metodo === "POST");
  assert.deepEqual(gravados.map((c) => c.caminho), ["/repos/o/r/statuses/c7", "/repos/o/r/statuses/c8"]);
  assert.deepEqual(gravados[1].corpo, { state: "failure", context: "base-atual", description: "3 commits atrás da main (aaaaaaa): atualize o branch e espere o CI antes do merge." });
});

test("base atual: um PR só (evento do próprio PR); sem permissão de gravar não derruba o job; --so-ler não grava", async () => {
  const semPermissao = apiFalsa({
    "GET /repos/o/r/pulls/9": { number: 9, state: "open", draft: true, base: { ref: "main" }, head: { sha: "c9" } },
    "GET /repos/o/r/compare/main...c9": { behind_by: 2, base_commit: { sha: PONTA } },
    "POST /repos/o/r/statuses/c9": new Error("403 Resource not accessible by integration"),
  });
  const r = await conferirBases({ api: semPermissao.api, repo: "o/r", numero: 9 });
  assert.deepEqual(r.map((x) => [x.numero, x.atras, x.gravado]), [[9, 2, false]]);
  const soLer = apiFalsa({
    "GET /repos/o/r/pulls/9": { number: 9, state: "open", draft: true, base: { ref: "main" }, head: { sha: "c9" } },
    "GET /repos/o/r/compare/main...c9": { behind_by: 0, base_commit: { sha: PONTA } },
  });
  await conferirBases({ api: soLer.api, repo: "o/r", numero: 9, soLer: true });
  assert.equal(soLer.chamadas.filter((c) => c.metodo !== "GET").length, 0);
  // PR com outra base (empilhado) não recebe status: a regra é sobre quem pousa na main.
  const empilhado = apiFalsa({ "GET /repos/o/r/pulls/10": { number: 10, state: "open", draft: true, base: { ref: "claude-b/x" }, head: { sha: "c10" } } });
  assert.deepEqual(await conferirBases({ api: empilhado.api, repo: "o/r", numero: 10 }), []);
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
  const abrir = apiFalsa({ "GET /repos/o/r/issues?state=open&per_page=100&page=1": [{ number: 1, title: "outra coisa" }], "POST /repos/o/r/issues": { number: 77 } });
  assert.deepEqual(await avisarDaMain({ api: abrir.api, repo: "o/r", run: run("failure") }), { acao: "abrir", aviso: 77 });
  assert.equal((abrir.chamadas.at(-1)!.corpo as { title: string }).title, "Main vermelha desde aaaaaaa (CI)");

  const verde = { workflow_runs: [{ status: "completed", conclusion: "success", head_sha: PONTA }] };
  const fechar = apiFalsa({
    "GET /repos/o/r/issues?state=open&per_page=100&page=1": [{ number: 77, title: "Main vermelha desde bbbbbbb (CI)" }, { number: 78, title: "PR disfarçado", pull_request: {} }],
    "GET /repos/o/r/actions/workflows/ci.yml/runs?branch=main&event=push&status=completed&per_page=1": verde,
    "GET /repos/o/r/actions/workflows/lab-critico.yml/runs?branch=main&event=push&status=completed&per_page=1": verde,
    "POST /repos/o/r/issues/77/comments": {},
    "PATCH /repos/o/r/issues/77": {},
  });
  assert.deepEqual(await avisarDaMain({ api: fechar.api, repo: "o/r", run: run("success") }), { acao: "fechar", aviso: 77 });
  assert.deepEqual(fechar.chamadas.at(-1), { metodo: "PATCH", caminho: "/repos/o/r/issues/77", corpo: { state: "closed", state_reason: "completed" } });

  const aindaVermelho = apiFalsa({
    "GET /repos/o/r/issues?state=open&per_page=100&page=1": [{ number: 77, title: "Main vermelha desde bbbbbbb (CI)" }],
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
  assert.doesNotMatch(w, /pull_request_target/);
  assert.match(w, /\non:\n  pull_request:\n    types: \[opened, reopened, synchronize, ready_for_review\]\n  push:\n    branches: \[main\]\n  workflow_run:\n    workflows: \["CI", "Lab crítico \(fluxos críticos\)"\]\n    types: \[completed\]\n    branches: \[main\]\n/);
  assert.match(w, /\npermissions:\n  contents: read\n/, "o padrão do workflow é só leitura");
  const jobBase = w.slice(w.indexOf("  conferir-base:"), w.indexOf("  main-vermelha:"));
  const jobMain = w.slice(w.indexOf("  main-vermelha:"));
  assert.match(jobBase, /if: github\.event_name != 'workflow_run'/);
  assert.match(jobBase, /permissions:\n      contents: read\n      pull-requests: read\n      statuses: write\n/);
  assert.doesNotMatch(jobBase, /issues: write|contents: write|actions:/);
  assert.match(jobMain, /if: github\.event_name == 'workflow_run' && github\.event\.workflow_run\.event == 'push'/);
  assert.match(jobMain, /permissions:\n      contents: read\n      actions: read\n      issues: write\n/);
  assert.doesNotMatch(jobMain, /statuses: write|contents: write|pull-requests: write/);
  // Os nomes dos workflows observados são os da main (se mudarem lá, o gatilho deixa de disparar).
  assert.match(readFileSync(".github/workflows/ci.yml", "utf8"), /^name: CI$/m);
  assert.match(readFileSync(".github/workflows/lab-critico.yml", "utf8"), /^name: Lab crítico \(fluxos críticos\)$/m);
  // Dado do evento entra por variável de ambiente, nunca colado no comando.
  assert.doesNotMatch(w, /run:[^\n]*\$\{\{ *github\.event/);
});
