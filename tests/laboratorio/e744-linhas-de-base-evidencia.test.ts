/*
  E744 — ramo de evidência das linhas de base visuais (decisão do Gerente, 16/11/2026, aprovada pelo Daniel).
  O workflow "Linhas de base visuais" refaz as imagens no ambiente do GitHub e as guardava só como artefato do Actions,
  que nem toda sessão consegue baixar. Agora, no disparo manual, um job à parte grava as imagens refeitas e um
  manifesto num ramo dedicado e descartável (`linhas-de-base-evidencia`), reescrito a cada corrida.
  O ramo nunca é mesclado: quem aprova copia para o PR só as imagens julgadas. A geração das imagens não mudou.
  Roda: node --test tests/laboratorio/e744-linhas-de-base-evidencia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_BYTES, MAX_IMAGENS, RAMO, ehPng, exigirRamo, listar, publicar, selecionar, textoManifesto } from "../../scripts/lab/linhas-de-base-evidencia.mjs";
import { fonteSemComentarios } from "../../src/lib/fonte-sem-comentarios.ts";

const RAIZ = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(RAIZ + p, "utf8");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("corpo-de-teste")]);

function pastaComImagens(): string {
  const pasta = mkdtempSync(join(tmpdir(), "evid-teste-"));
  const visual = join(pasta, "tests/e2e/visual");
  mkdirSync(join(visual, "t245-visual-regressao.spec.ts"), { recursive: true });
  mkdirSync(join(visual, "t263-visual-41.spec.ts"), { recursive: true });
  writeFileSync(join(visual, "t245-visual-regressao.spec.ts/02-home-cartoes-390.png"), PNG);
  writeFileSync(join(visual, "t263-visual-41.spec.ts/03-barra-proprietario-390.png"), Buffer.concat([PNG, Buffer.from("-outra")]));
  writeFileSync(join(visual, "t263-visual-41.spec.ts/falsa.png"), "isto não é um PNG");
  writeFileSync(join(visual, "t263-visual-41.spec.ts/video.webm"), "vídeo");
  writeFileSync(join(pasta, "linhas-de-base.txt"), "log da corrida");
  return pasta;
}

test("o destino é sempre e só o ramo de evidência; outro nome é recusado antes de qualquer comando git", () => {
  assert.equal(RAMO, "linhas-de-base-evidencia");
  assert.doesNotThrow(() => exigirRamo(RAMO));
  for (const outro of ["main", "lab-diffs", "", "refs/heads/main", "linhas-de-base-evidencia/../main"]) assert.throws(() => exigirRamo(outro), /destino recusado/);
  const chamadas: string[][] = [];
  assert.throws(() => publicar({ pasta: pastaComImagens(), run: "1", sha: "abc", ramo: "main", git: (args: string[]) => (chamadas.push(args), "") }), /destino recusado/);
  assert.deepEqual(chamadas, [], "nenhum comando git antes da recusa");
});

test("só PNG de verdade entra (extensão e assinatura); vídeo, log e PNG falso ficam de fora", () => {
  const pasta = pastaComImagens();
  assert.equal(ehPng(join(pasta, "tests/e2e/visual/t263-visual-41.spec.ts/falsa.png")), false);
  assert.deepEqual(
    listar(pasta).map((i) => i.caminho),
    ["tests/e2e/visual/t245-visual-regressao.spec.ts/02-home-cartoes-390.png", "tests/e2e/visual/t263-visual-41.spec.ts/03-barra-proprietario-390.png"],
  );
});

test("limites da corrida: até 120 imagens e 25 MB; o que passa fica listado, não publicado", () => {
  assert.equal(MAX_IMAGENS, 120);
  assert.equal(MAX_BYTES, 25 * 1024 * 1024);
  const imagens = Array.from({ length: 5 }, (_, i) => ({ caminho: `a/${i}.png`, bytes: 10, sha256: "x", origem: "" }));
  const r = selecionar(imagens, { maxImagens: 3 });
  assert.deepEqual([r.publicadas.length, r.restantes.length], [3, 2]);
  const porPeso = selecionar(imagens, { maxBytes: 25 });
  assert.deepEqual([porPeso.publicadas.length, porPeso.restantes.length], [2, 3]);
});

test("o manifesto diz a corrida, o commit e o ramo testados, e cada imagem com tamanho e sha256", () => {
  const texto = textoManifesto({ run: "43880015015", sha: "66ac4557", ramoTestado: "claude-b/x", repositorio: "dono/repo", publicadas: [{ caminho: "tests/e2e/visual/a/b.png", bytes: 2048, sha256: "f".repeat(64) }], restantes: [], geradoEm: "2026-11-16T16:00:00Z" });
  assert.match(texto, /corrida 43880015015/);
  assert.match(texto, /https:\/\/github\.com\/dono\/repo\/actions\/runs\/43880015015/);
  assert.match(texto, /`66ac4557`/);
  assert.match(texto, /`claude-b\/x`/);
  assert.match(texto, /\| `tests\/e2e\/visual\/a\/b\.png` \| 2048 \| `f{64}` \|/);
  assert.match(texto, /nunca é mesclado/);
  assert.match(texto, /git fetch origin linhas-de-base-evidencia/);
});

test("sem imagem refeita, o ramo não é tocado", () => {
  const vazia = mkdtempSync(join(tmpdir(), "evid-vazia-"));
  const chamadas: string[][] = [];
  const r = publicar({ pasta: vazia, run: "1", sha: "abc", ramo: RAMO, git: (args: string[]) => (chamadas.push(args), "") });
  assert.equal(r.estado, "sem-imagens");
  assert.deepEqual(chamadas, []);
});

test("publicar, com git de verdade: um commit órfão só com as imagens, o manifesto e o vercel.json; a segunda corrida reescreve", () => {
  const base = mkdtempSync(join(tmpdir(), "evid-git-"));
  const git = (args: string[], cwd: string) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const remoto = join(base, "remoto.git");
  const repo = join(base, "repo");
  git(["init", "--quiet", "--bare", remoto], base);
  git(["init", "--quiet", repo], base);
  git(["remote", "add", "origin", remoto], repo);
  writeFileSync(join(repo, "produto.txt"), "arquivo do produto: não pode ir para o ramo de evidência");
  git(["add", "."], repo);
  git(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "--quiet", "-m", "base"], repo);
  git(["push", "--quiet", "origin", "HEAD:refs/heads/main"], repo);
  const mainAntes = git(["rev-parse", "refs/heads/main"], remoto);

  for (const run of ["101", "102"]) {
    const r = publicar({ pasta: pastaComImagens(), run, sha: "abc1234", ramoTestado: "claude-b/x", ramo: RAMO, repo });
    assert.equal(r.estado, "publicado");
    assert.equal(r.publicadas, 2);
    const arquivos = git(["ls-tree", "-r", "--name-only", `refs/heads/${RAMO}`], remoto).split("\n").sort();
    assert.deepEqual(arquivos, ["README.md", "tests/e2e/visual/t245-visual-regressao.spec.ts/02-home-cartoes-390.png", "tests/e2e/visual/t263-visual-41.spec.ts/03-barra-proprietario-390.png", "vercel.json"]);
    assert.equal(git(["rev-list", "--count", `refs/heads/${RAMO}`], remoto), "1", "um commit só, sem histórico");
    assert.match(git(["show", `refs/heads/${RAMO}:README.md`], remoto), new RegExp(`corrida ${run}`));
    assert.deepEqual(JSON.parse(git(["show", `refs/heads/${RAMO}:vercel.json`], remoto)), { git: { deploymentEnabled: false } });
  }
  assert.equal(git(["rev-parse", "refs/heads/main"], remoto), mainAntes, "a main não foi tocada");
  assert.deepEqual(git(["for-each-ref", "--format=%(refname)"], remoto).split("\n").sort(), ["refs/heads/linhas-de-base-evidencia", "refs/heads/main"]);
  assert.equal(git(["status", "--porcelain"], repo), "", "a árvore de trabalho do checkout fica intacta");
});

test("o script não mescla, não apaga e não escreve em outro ramo", () => {
  const fonte = fonteSemComentarios(ler("scripts/lab/linhas-de-base-evidencia.mjs"));
  assert.doesNotMatch(fonte, /"merge"|"rebase"|"--delete"|refs\/heads\/main|gh\s+pr/);
  const pushes = [...fonte.matchAll(/\["push"[^\]]*\]/g)].map((m) => m[0]);
  assert.deepEqual(pushes, ['["push", "--quiet", remoto, `+${commit}:refs/heads/${RAMO}`]']);
});

test("workflow: a geração não mudou de permissão; só o job novo escreve, e só no disparo manual", () => {
  const wf = ler(".github/workflows/linhas-de-base.yml");
  assert.match(wf, /^permissions:\n  contents: read$/m, "o padrão do workflow continua só leitura");
  const gerar = wf.slice(wf.indexOf("  gerar:"), wf.indexOf("  publicar-evidencia:"));
  const publicarJob = wf.slice(wf.indexOf("  publicar-evidencia:"));
  assert.ok(gerar.length > 0 && publicarJob.length > 0);
  assert.doesNotMatch(gerar, /contents: write/);
  assert.match(gerar, /--update-snapshots/);
  assert.match(publicarJob, /needs: gerar/);
  assert.match(publicarJob, /if: \$\{\{ !cancelled\(\) && github\.event_name == 'workflow_dispatch' \}\}/);
  assert.match(publicarJob, /permissions:\n      contents: write/);
  assert.match(publicarJob, /node scripts\/lab\/linhas-de-base-evidencia\.mjs publicar [^\n]* --ramo linhas-de-base-evidencia/);
  assert.equal((wf.match(/contents: write/g) ?? []).length, 1);
  assert.doesNotMatch(wf, /pull_request_target/);
});

test("Vercel: o ramo de evidência não gera build", () => {
  const vercel = JSON.parse(ler("vercel.json"));
  assert.equal(vercel.git?.deploymentEnabled?.[RAMO], false);
});
