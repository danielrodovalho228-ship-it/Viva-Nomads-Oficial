/*
  E744, item A (15/11/2026) — diffs visuais do laboratório legíveis sem baixar o artifact.

  Quando um spec visual falha (t245, t271, t263), as imagens (esperado, obtido, diferença) ficavam só no artifact do Actions,
  que nem toda sessão consegue baixar. Agora:
    1) cada fatia junta SÓ as imagens dos testes visuais que falharam (scripts/lab/diffs-visuais.mjs coletar);
    2) um job separado, o único do workflow com contents: write, publica essas imagens num commit órfão no branch
       `lab-diffs`, reescrito a cada rodada (decisão do Gerente, 15/11: um branch só, sem histórico), com um README gerado;
    3) o mesmo job apaga o `lab-diffs` quando o último commit dele tem mais de 7 dias.
  Travas: o destino é sempre e só `lab-diffs`; só PNG; no máximo 60 imagens e 25 MB por rodada; nada de vídeo, trace, log
  nem relatório HTML (o repositório é público).

  Roda: node --test tests/laboratorio/e744-diffs-visuais.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DIAS_DE_GUARDA,
  MAX_BYTES,
  MAX_IMAGENS,
  RAMO,
  coletar,
  ehPng,
  exigirRamo,
  falhasVisuais,
  limpar,
  publicar,
  ramosParaApagar,
  selecionar,
  textoReadme,
} from "../../scripts/lab/diffs-visuais.mjs";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("imagem de teste")]);
const pasta = () => mkdtempSync(join(tmpdir(), "e744-diffs-"));
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
  }).trim();

/** Relatório do Playwright com um teste visual que falhou nas duas tentativas, no formato medido em 15/11 (1.x, retries=1). */
function relatorioComFalha(dir: string, opcoes: { status?: string; semDiff?: boolean } = {}) {
  const anexos = (sufixo: string) => {
    const base = join(dir, `saida${sufixo}`);
    mkdirSync(base, { recursive: true });
    const arquivos = ["home-390-actual.png", "home-390-diff.png", "test-failed-1.png", "video.webm", "error-context.md"];
    for (const a of arquivos) writeFileSync(join(base, a), a.endsWith(".png") ? PNG : "outro");
    const esperado = join(dir, "home-390.png");
    writeFileSync(esperado, PNG);
    return [
      { name: "home-390-expected.png", contentType: "image/png", path: esperado },
      { name: "home-390-actual.png", contentType: "image/png", path: join(base, "home-390-actual.png") },
      ...(opcoes.semDiff ? [] : [{ name: "home-390-diff.png", contentType: "image/png", path: join(base, "home-390-diff.png") }]),
      { name: "screenshot", contentType: "image/png", path: join(base, "test-failed-1.png") },
      { name: "video", contentType: "video/webm", path: join(base, "video.webm") },
      { name: "error-context", contentType: "text/markdown", path: join(base, "error-context.md") },
    ];
  };
  const teste = (titulo: string, status: string) => ({
    title: titulo,
    file: "t245-visual-regressao.spec.ts",
    tests: [{ status, expectedStatus: "passed", projectName: "chromium", results: [{ status: "failed", attachments: anexos("") }, { status: status === "flaky" ? "passed" : "failed", attachments: status === "flaky" ? [] : anexos("-retry1") }] }],
  });
  return {
    suites: [
      {
        title: "t245-visual-regressao.spec.ts",
        file: "t245-visual-regressao.spec.ts",
        specs: [teste("01. Home a 390 px", opcoes.status ?? "unexpected")],
        suites: [{ title: "outro bloco", specs: [{ title: "passou", file: "t245-visual-regressao.spec.ts", tests: [{ status: "expected", expectedStatus: "passed", projectName: "chromium", results: [{ status: "passed", attachments: [] }] }] }] }],
      },
    ],
  };
}

test("E744 item A: o único destino aceito é o branch lab-diffs", () => {
  assert.equal(RAMO, "lab-diffs");
  assert.doesNotThrow(() => exigirRamo("lab-diffs"));
  for (const ruim of ["main", "lab-diffs/123", "lab-diffs-2", "refs/heads/lab-diffs", "claude-b/x", "", " lab-diffs", "lab-diffs ", "LAB-DIFFS"])
    assert.throws(() => exigirRamo(ruim), /lab-diffs/, `recusa "${ruim}"`);
});

test("E744 item A: publicar e limpar recusam outro destino ANTES de qualquer comando git", () => {
  const chamadas: string[][] = [];
  const espiao = (args: string[]) => {
    chamadas.push(args);
    return "";
  };
  assert.throws(() => publicar({ pasta: pasta(), run: "1", sha: "abc", ramo: "main", repo: pasta(), git: espiao }), /lab-diffs/);
  assert.throws(() => limpar({ ramo: "claude-b/outra", repo: pasta(), git: espiao }), /lab-diffs/);
  assert.deepEqual(chamadas, [], "nenhum comando git rodou");
});

test("E744 item A: só PNG de verdade (extensão e assinatura)", () => {
  const dir = pasta();
  writeFileSync(join(dir, "ok.png"), PNG);
  writeFileSync(join(dir, "falso.png"), "<html>não é png</html>");
  writeFileSync(join(dir, "video.webm"), PNG);
  writeFileSync(join(dir, "trace.zip"), "PK");
  assert.equal(ehPng(join(dir, "ok.png")), true);
  assert.equal(ehPng(join(dir, "falso.png")), false, "extensão .png sem assinatura de PNG não passa");
  assert.equal(ehPng(join(dir, "video.webm")), false, "assinatura de PNG com outra extensão não passa");
  assert.equal(ehPng(join(dir, "trace.zip")), false);
  assert.equal(ehPng(join(dir, "nao-existe.png")), false);
});

test("E744 item A: a coleta pega só esperado, obtido e diferença dos testes visuais que FALHARAM (última tentativa)", () => {
  const dir = pasta();
  const falhas = falhasVisuais(relatorioComFalha(dir));
  assert.equal(falhas.length, 1);
  assert.equal(falhas[0].spec, "t245-visual-regressao.spec.ts");
  assert.equal(falhas[0].titulo, "01. Home a 390 px");
  assert.deepEqual(falhas[0].imagens.map((i: { nome: string }) => i.nome), ["home-390-expected.png", "home-390-actual.png", "home-390-diff.png"]);
  assert.ok(falhas[0].imagens[1].origem.includes("-retry1"), "vale a última tentativa");
  // Instável (passou na nova tentativa) e teste que passou não entram.
  assert.deepEqual(falhasVisuais(relatorioComFalha(pasta(), { status: "flaky" })), []);
  // Falha por tamanho diferente não tem imagem de diferença: entram as duas que existem.
  assert.equal(falhasVisuais(relatorioComFalha(pasta(), { semDiff: true }))[0].imagens.length, 2);

  const destino = join(pasta(), "lab-diffs");
  const r = coletar(relatorioComFalha(dir), destino);
  assert.equal(r.imagens, 3);
  const base = join(destino, "t245-visual-regressao");
  const [caso] = readdirSync(base);
  assert.deepEqual(readdirSync(join(base, caso)).sort(), ["home-390-actual.png", "home-390-diff.png", "home-390-expected.png"]);
  const indice = JSON.parse(readFileSync(join(destino, "indice.json"), "utf8"));
  assert.equal(indice.casos[0].titulo, "01. Home a 390 px");
  assert.equal(indice.casos[0].arquivos.length, 3);
  // Nada além de PNG e do índice: sem vídeo, trace, log, print genérico nem relatório.
  const tudo: string[] = [];
  const varrer = (d: string) => readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? varrer(join(d, e.name)) : tudo.push(e.name)));
  varrer(destino);
  assert.deepEqual(tudo.filter((n) => !n.endsWith(".png")), ["indice.json"]);
  assert.ok(!tudo.includes("test-failed-1.png"), "o print genérico da falha não é diff visual");
});

test("E744 item A: sem falha visual a coleta não cria pasta nenhuma (não há artefato e a publicação pula)", () => {
  const destino = join(pasta(), "lab-diffs");
  const r = coletar(relatorioComFalha(pasta(), { status: "flaky" }), destino);
  assert.equal(r.imagens, 0);
  assert.equal(existsSync(destino), false);
});

test("E744 item A: limites de 60 imagens e 25 MB por rodada; o que passa do limite fica listado, não publicado", () => {
  assert.equal(MAX_IMAGENS, 60);
  assert.equal(MAX_BYTES, 25 * 1024 * 1024);
  const muitas = Array.from({ length: 75 }, (_, i) => ({ caminho: `t245/caso-${String(i).padStart(2, "0")}/a.png`, bytes: 1000 }));
  const porQuantidade = selecionar(muitas);
  assert.equal(porQuantidade.publicadas.length, 60);
  assert.equal(porQuantidade.restantes.length, 15);
  assert.equal(porQuantidade.publicadas[0].caminho, "t245/caso-00/a.png", "publica as primeiras, na ordem");
  assert.equal(porQuantidade.restantes[0].caminho, "t245/caso-60/a.png");
  const pesadas = Array.from({ length: 10 }, (_, i) => ({ caminho: `t271/${i}.png`, bytes: 4 * 1024 * 1024 }));
  const porPeso = selecionar(pesadas);
  assert.equal(porPeso.publicadas.length, 6, "6 × 4 MB = 24 MB cabem; a 7ª passaria de 25 MB");
  assert.equal(porPeso.restantes.length, 4);
  assert.ok(porPeso.publicadas.reduce((s: number, i: { bytes: number }) => s + i.bytes, 0) <= MAX_BYTES);
  // Depois de estourar, nenhuma imagem seguinte "fura a fila" por ser pequena: a ordem é a do índice.
  const mista = [...pesadas.slice(0, 7), { caminho: "t263/pequena.png", bytes: 10 }];
  assert.deepEqual(selecionar(mista).restantes.map((i: { caminho: string }) => i.caminho), ["t271/6.png", "t263/pequena.png"]);
});

test("E744 item A: o README diz a rodada, o commit testado, cada spec com o caminho de cada imagem e o que ficou de fora", () => {
  const texto = textoReadme({
    run: "43664453319",
    sha: "c950ec8224098b5ae70d99b6af8ae749506b250f",
    repositorio: "dono/repo",
    casos: [{ spec: "t245-visual-regressao.spec.ts", titulo: "01. Home a 390 px", arquivos: ["t245-visual-regressao/01-home-a-390-px/home-390-actual.png", "t245-visual-regressao/01-home-a-390-px/home-390-diff.png"] }],
    publicadas: [{ caminho: "t245-visual-regressao/01-home-a-390-px/home-390-actual.png", bytes: 10 }],
    restantes: [{ caminho: "t245-visual-regressao/01-home-a-390-px/home-390-diff.png", bytes: 10 }],
  });
  assert.match(texto, /43664453319/);
  assert.match(texto, /c950ec8224098b5ae70d99b6af8ae749506b250f/);
  assert.match(texto, /t245-visual-regressao\.spec\.ts/);
  assert.match(texto, /01\. Home a 390 px/);
  assert.match(texto, /`t245-visual-regressao\/01-home-a-390-px\/home-390-actual\.png`/);
  assert.match(texto, /não publicad[ao]s?[\s\S]*home-390-diff\.png/i);
  assert.match(texto, /git fetch origin lab-diffs/);
});

test("E744 item A: a limpeza só escolhe o lab-diffs, e só com mais de 7 dias", () => {
  assert.equal(DIAS_DE_GUARDA, 7);
  const agora = Date.UTC(2026, 10, 15, 12, 0, 0);
  const dia = 86_400_000;
  const refs = (idadeDoLab: number) => [
    { nome: "lab-diffs", criadoEmMs: agora - idadeDoLab * dia },
    { nome: "main", criadoEmMs: agora - 300 * dia },
    { nome: "lab-diffs-antigo", criadoEmMs: agora - 300 * dia },
    { nome: "claude-b/lab-diffs", criadoEmMs: agora - 300 * dia },
  ];
  assert.deepEqual(ramosParaApagar(refs(8), agora), ["lab-diffs"]);
  assert.deepEqual(ramosParaApagar(refs(7.01), agora), ["lab-diffs"]);
  assert.deepEqual(ramosParaApagar(refs(6.9), agora), [], "com menos de 7 dias fica");
  assert.deepEqual(ramosParaApagar(refs(0), agora), []);
});

test("E744 item A (git de verdade, repositório de ensaio): publica um commit órfão em lab-diffs, reescreve na rodada seguinte e limpa depois de 7 dias", () => {
  const remoto = pasta();
  git(remoto, "init", "--bare", "-q", "-b", "main");
  const repo = pasta();
  git(repo, "init", "-q", "-b", "main");
  git(repo, "remote", "add", "origin", remoto);
  writeFileSync(join(repo, "produto.txt"), "código do produto");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "main");
  git(repo, "push", "-q", "origin", "main");
  git(repo, "push", "-q", "origin", "main:outra-branch");

  // Rodada 1: dois artifacts de fatia baixados, cada um com o seu índice.
  const baixados = pasta();
  for (const fatia of [6, 7]) {
    const origem = pasta();
    coletar(relatorioComFalha(origem), join(baixados, `lab-diffs-111-fatia-${fatia}`));
  }
  // Lixo que não pode ser publicado, mesmo que apareça na pasta baixada.
  writeFileSync(join(baixados, "lab-diffs-111-fatia-6", "video.webm"), "x");
  writeFileSync(join(baixados, "lab-diffs-111-fatia-6", "index.html"), "<html>");
  const r1 = publicar({ pasta: baixados, run: "111", sha: "aaa111", ramo: "lab-diffs", repo, repositorio: "dono/repo" });
  assert.equal(r1.estado, "publicado");
  assert.equal(r1.publicadas, 3, "os dois artifacts trazem o mesmo teste; o caminho repetido não duplica");
  const arquivos1 = git(repo, "ls-tree", "-r", "--name-only", r1.commit).split("\n").sort();
  assert.ok(arquivos1.includes("README.md"));
  assert.ok(arquivos1.includes("vercel.json"), "o branch diz à Vercel para não construir");
  assert.deepEqual(arquivos1.filter((a) => !a.endsWith(".png") && a !== "README.md" && a !== "vercel.json"), [], "só PNG, o README e o vercel.json");
  assert.equal(arquivos1.filter((a) => a.endsWith(".png")).length, 3);
  assert.ok(!arquivos1.includes("produto.txt"), "commit órfão: nada da main vai junto");
  assert.equal(git(repo, "rev-list", "--count", r1.commit), "1", "sem pai");
  assert.equal(git(remoto, "rev-parse", "refs/heads/lab-diffs"), r1.commit);
  assert.match(git(repo, "show", `${r1.commit}:README.md`), /aaa111/);
  assert.deepEqual(JSON.parse(git(repo, "show", `${r1.commit}:vercel.json`)), { git: { deploymentEnabled: false } });

  // Rodada 2: o mesmo branch é reescrito (sem histórico), e só ele.
  const main = git(remoto, "rev-parse", "refs/heads/main");
  const r2 = publicar({ pasta: baixados, run: "222", sha: "bbb222", ramo: "lab-diffs", repo, repositorio: "dono/repo" });
  assert.notEqual(r2.commit, r1.commit);
  assert.equal(git(remoto, "rev-parse", "refs/heads/lab-diffs"), r2.commit);
  assert.equal(git(repo, "rev-list", "--count", r2.commit), "1", "a rodada nova não carrega a anterior");
  assert.equal(git(remoto, "rev-parse", "refs/heads/main"), main, "a main não foi tocada");
  assert.equal(git(repo, "status", "--porcelain"), "", "a árvore de trabalho do checkout fica intacta");

  // Sem nenhuma imagem: não publica nada e não mexe no branch.
  const vazio = publicar({ pasta: pasta(), run: "333", sha: "ccc", ramo: "lab-diffs", repo, repositorio: "dono/repo" });
  assert.equal(vazio.estado, "sem-imagens");
  assert.equal(git(remoto, "rev-parse", "refs/heads/lab-diffs"), r2.commit);

  // Limpeza: com 6 dias fica; com 8 dias sai. As outras branches ficam sempre.
  const agora = Date.now();
  assert.deepEqual(limpar({ ramo: "lab-diffs", repo, agora: agora + 6 * 86_400_000 }).apagados, []);
  assert.equal(git(remoto, "rev-parse", "refs/heads/lab-diffs"), r2.commit);
  assert.deepEqual(limpar({ ramo: "lab-diffs", repo, agora: agora + 8 * 86_400_000 }).apagados, ["lab-diffs"]);
  assert.equal(git(remoto, "for-each-ref", "--format=%(refname)").split("\n").sort().join(" "), "refs/heads/main refs/heads/outra-branch");
  // Sem o branch, limpar de novo não falha.
  assert.deepEqual(limpar({ ramo: "lab-diffs", repo, agora: agora + 9 * 86_400_000 }).apagados, []);
});

const yml = readFileSync(".github/workflows/laboratorio.yml", "utf8");
/** O bloco de um job (do nome até o próximo job no mesmo nível). */
function job(nome: string): string {
  const i = yml.indexOf(`\n  ${nome}:\n`);
  assert.ok(i > 0, `o job ${nome} existe`);
  const resto = yml.slice(i + 1);
  const fim = resto.slice(nome.length + 4).search(/\n  [a-z][a-z0-9-]*:\n/);
  return fim < 0 ? resto : resto.slice(0, fim + nome.length + 4);
}

test("E744 item A (workflow): só o job de publicação escreve no repositório; o padrão segue contents: read", () => {
  assert.match(yml, /\npermissions:\n  contents: read\n/, "o padrão do workflow é só leitura");
  assert.equal([...yml.matchAll(/contents:\s*write/g)].length, 1, "um único contents: write no arquivo");
  const publicacao = job("publicar-diffs");
  assert.match(publicacao, /permissions:\n\s+contents: write/);
  for (const outro of ["laboratorio", "construir", "consolidar"]) assert.doesNotMatch(job(outro), /contents:\s*write|permissions:/, `${outro} não ganha permissão`);
  assert.doesNotMatch(yml, /permissions:\s*write-all/);
});

test("E744 item A (workflow): a publicação depende da suíte e só roda no agendado e no disparo manual, nunca em PR", () => {
  const publicacao = job("publicar-diffs");
  assert.match(publicacao, /needs: laboratorio/);
  const condicao = /\n    if: (.+)\n/.exec(publicacao)?.[1] ?? "";
  assert.match(condicao, /github\.event_name == 'schedule'/);
  assert.match(condicao, /github\.event_name == 'workflow_dispatch'/);
  assert.match(condicao, /!cancelled\(\)/, "roda mesmo com fatia vermelha (é quando há diff)");
  assert.doesNotMatch(condicao, /pull_request/);
  assert.doesNotMatch(publicacao, /pull_request/);
  // Só o script publica e limpa, sempre no branch fixo.
  assert.match(publicacao, /diffs-visuais\.mjs publicar [^\n]*--ramo lab-diffs(\s|$)/m);
  assert.match(publicacao, /diffs-visuais\.mjs limpar [^\n]*--ramo lab-diffs(\s|$)/m);
  assert.doesNotMatch(publicacao, /git push|--force|secrets\./, "nada de push solto, nem segredo, no YAML");
});

test("E744 item A (workflow): cada fatia coleta os diffs depois da suíte e guarda um artefato próprio, só quando há imagem", () => {
  const fatia = job("laboratorio");
  const coleta = fatia.indexOf("diffs-visuais.mjs coletar");
  assert.ok(coleta > fatia.indexOf("- name: Rodar a suíte E2E"), "depois da suíte");
  assert.ok(coleta < fatia.indexOf("- name: Marcar a fatia como falha"), "antes do veredito");
  assert.match(fatia, /name: lab-diffs-\$\{\{ github\.run_id \}\}-fatia-\$\{\{ matrix\.fatia \}\}/);
  assert.match(fatia, /if-no-files-found: ignore/);
  const publicacao = job("publicar-diffs");
  assert.match(publicacao, /pattern: lab-diffs-\$\{\{ github\.run_id \}\}-\*/);
});

test("E744 item A (Vercel): o branch lab-diffs não gera build; os crons e o resto do vercel.json ficam", () => {
  const v = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.deepEqual(v.git, { deploymentEnabled: { "lab-diffs": false } });
  assert.equal(v.framework, "nextjs");
  assert.ok(Array.isArray(v.crons) && v.crons.length >= 13);
});
