/*
  E744 — ramo de evidência das linhas de base visuais (decisão do Gerente, 16/11/2026, aprovada pelo Daniel).

  O workflow "Linhas de base visuais" (.github/workflows/linhas-de-base.yml) refaz as imagens-base do t245, t263 e t271
  no ambiente do GitHub (mesmo Chromium e mesmas fontes do laboratório) e as guardava só como artefato do Actions. O
  armazenamento dos artefatos não é alcançável por toda sessão, e a referência visual tem de ser o arquivo exato gerado
  lá: gravada noutra máquina, parte das imagens não bate.

  Um comando, usado só pelo job `publicar-evidencia` desse workflow, e só no disparo manual:

    publicar <pasta> --run N --sha S --ramo-testado B --repositorio R --ramo linhas-de-base-evidencia
        empurra UM commit órfão (as imagens refeitas, nos mesmos caminhos do repositório, mais o manifesto README.md)
        para o ramo `linhas-de-base-evidencia`, que é reescrito a cada corrida: não tem histórico.

  O ramo é dedicado e descartável: nunca é mesclado, não gera build na Vercel e pode ser apagado depois da cópia. Aprovar
  uma imagem-base continua a ser decisão de produto: quem aprova copia para o PR SÓ as imagens julgadas. A fonte da
  verdade é o que entra no PR, não este ramo.

  Travas (cada uma com teste em tests/laboratorio/e744-linhas-de-base-evidencia.test.ts):
    - o destino é sempre e só o ramo `linhas-de-base-evidencia`; outro nome é recusado antes de qualquer comando git;
    - só PNG (extensão e assinatura do arquivo); nada de vídeo, trace nem log;
    - no máximo 120 imagens e 25 MB por corrida; o que passa do limite fica listado no manifesto, não publicado;
    - não toca na árvore de trabalho do checkout, não mescla, não apaga ramo e não escreve em nenhum outro ramo.

  Como ler: git fetch origin linhas-de-base-evidencia && git show FETCH_HEAD:README.md
            git checkout FETCH_HEAD -- <caminho da imagem>
*/
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";

export const RAMO = "linhas-de-base-evidencia";
// 120: as 65 telas com referência versionada (t245, t263, t271), com folga. Hoje somam 4,2 MB.
export const MAX_IMAGENS = 120;
export const MAX_BYTES = 25 * 1024 * 1024;
const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** O único destino aceito. Recusa antes de qualquer comando git. */
export function exigirRamo(ramo) {
  if (ramo !== RAMO) throw new Error(`destino recusado: "${ramo}". As linhas de base refeitas só vão para o ramo ${RAMO}.`);
}

/** PNG de verdade: extensão .png E a assinatura de 8 bytes do formato. */
export function ehPng(caminho) {
  if (!String(caminho).toLowerCase().endsWith(".png") || !existsSync(caminho)) return false;
  try {
    if (!statSync(caminho).isFile()) return false;
    const fd = openSync(caminho, "r");
    try {
      const inicio = Buffer.alloc(8);
      return readSync(fd, inicio, 0, 8, 0) === 8 && inicio.equals(ASSINATURA_PNG);
    } finally {
      closeSync(fd);
    }
  } catch {
    return false;
  }
}

const posix = (caminho) => caminho.split(sep).join("/");

/** As imagens refeitas dentro de `pasta`, em ordem, com o caminho relativo (o mesmo do repositório), tamanho e sha256. */
export function listar(pasta) {
  const achadas = [];
  if (!existsSync(pasta)) return achadas;
  const varrer = (dir) => {
    for (const nome of readdirSync(dir).sort()) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) varrer(p);
      else if (ehPng(p)) achadas.push({ caminho: posix(relative(pasta, p)), bytes: statSync(p).size, sha256: createHash("sha256").update(readFileSync(p)).digest("hex"), origem: p });
    }
  };
  varrer(pasta);
  return achadas;
}

/** Limites da corrida: publica as primeiras, na ordem, até 120 imagens e 25 MB; a partir do primeiro estouro, tudo é resto. */
export function selecionar(imagens, limites = {}) {
  const maxImagens = limites.maxImagens ?? MAX_IMAGENS;
  const maxBytes = limites.maxBytes ?? MAX_BYTES;
  const publicadas = [];
  let bytes = 0;
  let i = 0;
  for (; i < imagens.length; i++) {
    if (publicadas.length >= maxImagens || bytes + imagens[i].bytes > maxBytes) break;
    publicadas.push(imagens[i]);
    bytes += imagens[i].bytes;
  }
  return { publicadas, restantes: imagens.slice(i) };
}

export function textoManifesto({ run, sha, ramoTestado = "", repositorio = "", publicadas, restantes, geradoEm = "" }) {
  const mb = (publicadas.reduce((s, p) => s + p.bytes, 0) / (1024 * 1024)).toFixed(1).replace(".", ",");
  const linhas = [
    `# Linhas de base visuais refeitas — corrida ${run}`,
    "",
    "Gerado pelo job `publicar-evidencia` do workflow `linhas-de-base.yml` (E744). **Ramo de evidência, descartável:** é reescrito a cada corrida, não tem histórico e nunca é mesclado. Aprovar uma imagem-base é decisão de produto: copie para o PR só as imagens julgadas. A fonte da verdade é o que entra no PR.",
    "",
    `- **Corrida:** ${run}${repositorio ? ` (https://github.com/${repositorio}/actions/runs/${run})` : ""}`,
    `- **Commit testado:** \`${sha}\``,
    `- **Ramo testado:** \`${ramoTestado || "?"}\``,
    `- **Gerado em:** ${geradoEm || new Date().toISOString()}`,
    `- **Imagens:** ${publicadas.length} (${mb} MB); limite de ${MAX_IMAGENS} imagens e ${MAX_BYTES / (1024 * 1024)} MB por corrida, só PNG.`,
    "",
    "O workflow regrava só as imagens que NÃO batem com as do ramo testado. Cada imagem está aqui no mesmo caminho que tem no repositório.",
    "",
    "## Como ler",
    "",
    "```bash",
    `git fetch origin ${RAMO}`,
    "git show FETCH_HEAD:README.md",
    "git checkout FETCH_HEAD -- <caminho da imagem>",
    "```",
    "",
    "## Imagens",
    "",
    "| Caminho | Bytes | sha256 |",
    "|---|---|---|",
  ];
  for (const p of publicadas) linhas.push(`| \`${p.caminho}\` | ${p.bytes} | \`${p.sha256}\` |`);
  linhas.push("");
  if (restantes.length) {
    linhas.push(`## Não publicadas (${restantes.length}): passaram do limite da corrida`, "", "Estão no artefato `linhas-de-base-<corrida>` do Actions.", "");
    for (const r of restantes) linhas.push(`- \`${r.caminho}\``);
    linhas.push("");
  }
  return linhas.join("\n");
}

/**
 * Quem roda o git: recebe os argumentos e, se precisar, a pasta e o ambiente; devolve a saída.
 * @typedef {(args: string[], opcoes?: { cwd?: string, env?: Record<string, string> }) => string} RodarGit
 */

/** @param {string} repo @returns {RodarGit} */
function gitDe(repo) {
  return (args, opcoes = {}) =>
    execFileSync("git", args, { cwd: opcoes.cwd ?? repo, encoding: "utf8", env: { ...process.env, ...(opcoes.env ?? {}) }, stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/**
 * Publica as imagens refeitas num commit órfão no ramo `linhas-de-base-evidencia` (reescreve o ramo).
 * Não toca na árvore de trabalho do checkout: monta a árvore num índice temporário.
 * @param {{ pasta: string, run: string, sha: string, ramo: string, ramoTestado?: string, repo?: string, remoto?: string, repositorio?: string, git?: RodarGit | null, geradoEm?: string }} opcoes
 * @returns {{ estado: "publicado" | "sem-imagens", commit: string, publicadas: number, restantes: number }}
 */
export function publicar({ pasta, run, sha, ramo, ramoTestado = "", repo = process.cwd(), remoto = "origin", repositorio = "", git = null, geradoEm = "" }) {
  exigirRamo(ramo);
  const imagens = listar(pasta);
  if (imagens.length === 0) return { estado: "sem-imagens", commit: "", publicadas: 0, restantes: 0 };
  const rodar = git ?? gitDe(repo);
  const { publicadas, restantes } = selecionar(imagens);

  const montagem = mkdtempSync(join(tmpdir(), "linhas-de-base-"));
  for (const p of publicadas) {
    mkdirSync(dirname(join(montagem, p.caminho)), { recursive: true });
    copyFileSync(p.origem, join(montagem, p.caminho));
  }
  writeFileSync(join(montagem, "README.md"), textoManifesto({ run, sha, ramoTestado, repositorio, publicadas, restantes, geradoEm }));
  // O ramo só tem imagens: a Vercel não deve tentar construir nada a partir dele.
  writeFileSync(join(montagem, "vercel.json"), `${JSON.stringify({ git: { deploymentEnabled: false } }, null, 2)}\n`);

  const env = {
    GIT_DIR: rodar(["rev-parse", "--absolute-git-dir"]),
    GIT_WORK_TREE: montagem,
    GIT_INDEX_FILE: join(mkdtempSync(join(tmpdir(), "linhas-de-base-indice-")), "index"),
    GIT_AUTHOR_NAME: "linhas de base (laboratório)",
    GIT_AUTHOR_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com",
    GIT_COMMITTER_NAME: "linhas de base (laboratório)",
    GIT_COMMITTER_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com",
  };
  rodar(["add", "-A", "--force", "."], { cwd: montagem, env });
  const arvore = rodar(["write-tree"], { cwd: montagem, env });
  const commit = rodar(["commit-tree", arvore, "-m", `linhas de base: corrida ${run} (commit ${sha})`], { cwd: montagem, env });
  // Reescreve SÓ refs/heads/linhas-de-base-evidencia (o nome já foi conferido acima).
  rodar(["push", "--quiet", remoto, `+${commit}:refs/heads/${RAMO}`]);
  return { estado: "publicado", commit, publicadas: publicadas.length, restantes: restantes.length };
}

function principal() {
  const [comando, ...resto] = process.argv.slice(2);
  const opcao = (nome) => (resto.indexOf(nome) >= 0 ? resto[resto.indexOf(nome) + 1] : undefined);
  const posicionais = resto.filter((a, i) => !a.startsWith("--") && !String(resto[i - 1]).startsWith("--"));
  try {
    if (comando !== "publicar") throw new Error("uso: linhas-de-base-evidencia.mjs publicar <pasta> --run N --sha S --ramo-testado B --repositorio R --ramo linhas-de-base-evidencia");
    const [pasta] = posicionais;
    if (!pasta) throw new Error("falta a pasta com as imagens refeitas");
    const r = publicar({ pasta, run: opcao("--run") ?? "?", sha: opcao("--sha") ?? "?", ramoTestado: opcao("--ramo-testado") ?? "", ramo: opcao("--ramo") ?? "", repositorio: opcao("--repositorio") ?? "" });
    console.log(
      r.estado === "publicado"
        ? `linhas de base: ${r.publicadas} imagem(ns) no ramo ${RAMO} (commit ${r.commit})${r.restantes ? `; ${r.restantes} ficaram de fora pelo limite e estão listadas no manifesto` : ""}.`
        : "linhas de base: nenhuma imagem refeita nesta corrida; o ramo não foi tocado.",
    );
  } catch (e) {
    console.error(`::error::${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) principal();
