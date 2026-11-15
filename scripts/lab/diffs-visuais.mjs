/*
  E744, item A (15/11/2026) — diffs visuais do laboratório legíveis sem baixar o artifact do Actions.

  Quando um spec visual falha (t245, t271, t263), as imagens da falha (esperado, obtido, diferença) ficavam só no artifact da
  fatia. O armazenamento dos artifacts não é alcançável por toda sessão, e sem ver as imagens não dá para julgar tela a tela
  se a mudança é legítima (regrava-se a referência, com o julgamento registrado) ou regressão (corrige-se).

  Três comandos, usados só pelo workflow do laboratório (.github/workflows/laboratorio.yml):

    coletar  <resultado.json> <destino>     na fatia, depois do Playwright: copia para <destino> SÓ as imagens dos testes
                                            visuais que falharam (última tentativa) e grava <destino>/indice.json. Sem
                                            falha visual, não cria a pasta: não há artefato e a publicação pula.
    publicar <pasta> --run N --sha S --ramo lab-diffs
                                            no job de publicação: junta os índices das fatias, aplica os limites e empurra
                                            UM commit órfão (README + imagens) para o branch `lab-diffs`, que é reescrito a
                                            cada rodada (decisão do Gerente, 15/11: um branch só, sem histórico — o julgamento
                                            consome as imagens uma vez e o repositório é público).
    limpar   --ramo lab-diffs [--dias 7]    apaga o `lab-diffs` quando o último commit dele tem mais de 7 dias.

  Travas (cada uma com teste em tests/laboratorio/e744-diffs-visuais.test.ts):
    - o destino é sempre e só o branch `lab-diffs`; qualquer outro nome é recusado antes de qualquer comando git;
    - só PNG (extensão e assinatura do arquivo); nada de vídeo, trace, log nem relatório HTML;
    - no máximo 60 imagens e 25 MB por rodada; o que passa do limite fica listado no README, não publicado.

  Como a sessão lê: git fetch origin lab-diffs && git show FETCH_HEAD:README.md  (as imagens: git checkout FETCH_HEAD -- <caminho>).
*/
import { execFileSync } from "node:child_process";
import { closeSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, sep } from "node:path";

export const RAMO = "lab-diffs";
export const MAX_IMAGENS = 60;
export const MAX_BYTES = 25 * 1024 * 1024;
export const DIAS_DE_GUARDA = 7;
const DIA_MS = 86_400_000;
const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IMAGEM_DE_DIFF = /-(expected|actual|diff)\.png$/;
const ORDEM = { expected: 0, actual: 1, diff: 2 };

/** O único destino aceito. Recusa antes de qualquer comando git. */
export function exigirRamo(ramo) {
  if (ramo !== RAMO) throw new Error(`destino recusado: "${ramo}". Os diffs visuais só vão para o branch ${RAMO}.`);
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

/**
 * Testes visuais que FALHARAM num relatório JSON do Playwright: os que terminaram "unexpected" e cuja última tentativa
 * anexou imagens de comparação (`<nome>-expected.png`, `-actual.png`, `-diff.png`). Instável (passou na nova tentativa)
 * não entra. O print genérico da falha, o vídeo e o contexto do erro não são diff visual e ficam de fora.
 */
export function falhasVisuais(relatorio) {
  const saida = [];
  const varrer = (suites, arquivoPai) => {
    for (const s of suites ?? []) {
      const arquivo = s.file ?? arquivoPai ?? "";
      for (const spec of s.specs ?? []) {
        for (const t of spec.tests ?? []) {
          if (t.status !== "unexpected") continue;
          const ultima = (t.results ?? []).at(-1);
          const imagens = (ultima?.attachments ?? [])
            .filter((a) => a?.contentType === "image/png" && typeof a.path === "string" && IMAGEM_DE_DIFF.test(String(a.name)))
            .map((a) => ({ nome: basename(String(a.name)), origem: a.path }))
            .sort((a, b) => ORDEM[IMAGEM_DE_DIFF.exec(a.nome)[1]] - ORDEM[IMAGEM_DE_DIFF.exec(b.nome)[1]] || a.nome.localeCompare(b.nome));
          if (imagens.length) saida.push({ spec: basename(spec.file ?? arquivo), titulo: spec.title, projeto: t.projectName ?? "", imagens });
        }
      }
      varrer(s.suites, arquivo);
    }
  };
  varrer(relatorio?.suites, "");
  return saida;
}

const pedaco = (texto) =>
  String(texto)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60) || "teste";
const posix = (caminho) => caminho.split(sep).join("/");

/** Copia para `destino` as imagens das falhas visuais e grava o índice. Sem imagem, não cria nada. */
export function coletar(relatorio, destino) {
  const casos = [];
  let imagens = 0;
  for (const f of falhasVisuais(relatorio)) {
    const pasta = join(f.spec.replace(/\.spec\.ts$/, ""), pedaco(f.titulo) + (f.projeto && f.projeto !== "chromium" ? `-${pedaco(f.projeto)}` : ""));
    const arquivos = [];
    for (const img of f.imagens) {
      if (!ehPng(img.origem)) continue;
      mkdirSync(join(destino, pasta), { recursive: true });
      copyFileSync(img.origem, join(destino, pasta, img.nome));
      arquivos.push(posix(join(pasta, img.nome)));
    }
    if (arquivos.length) casos.push({ spec: f.spec, titulo: f.titulo, projeto: f.projeto, arquivos });
    imagens += arquivos.length;
  }
  if (imagens > 0) writeFileSync(join(destino, "indice.json"), JSON.stringify({ casos }, null, 2));
  return { casos: casos.length, imagens };
}

/** Limites da rodada: publica as primeiras, na ordem, até 60 imagens e 25 MB; a partir do primeiro estouro, tudo é resto. */
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

export function textoReadme({ run, sha, repositorio = "", casos, publicadas, restantes, geradoEm = "" }) {
  const publicado = new Set(publicadas.map((p) => p.caminho));
  const mb = (publicadas.reduce((s, p) => s + p.bytes, 0) / (1024 * 1024)).toFixed(1).replace(".", ",");
  const linhas = [
    `# Diffs visuais do laboratório — rodada ${run}`,
    "",
    "Gerado pelo job `publicar-diffs` do workflow `laboratorio.yml` (E744, item A). Este branch é reescrito a cada rodada: não tem histórico.",
    "",
    `- **Rodada:** ${run}${repositorio ? ` (https://github.com/${repositorio}/actions/runs/${run})` : ""}`,
    `- **Commit testado:** \`${sha}\``,
    `- **Gerado em:** ${geradoEm || new Date().toISOString()}`,
    `- **Imagens publicadas:** ${publicadas.length} (${mb} MB); limite de ${MAX_IMAGENS} imagens e ${MAX_BYTES / (1024 * 1024)} MB por rodada, só PNG.`,
    "",
    "Em cada teste: `-expected.png` é a referência versionada, `-actual.png` é o que a rodada desenhou e `-diff.png` marca a diferença (não existe quando o tamanho da imagem mudou).",
    "",
    "## Como ler",
    "",
    "```bash",
    `git fetch origin ${RAMO}`,
    "git show FETCH_HEAD:README.md",
    "git checkout FETCH_HEAD -- <caminho da imagem>",
    "```",
    "",
    "## Specs e imagens",
    "",
  ];
  for (const c of casos) {
    linhas.push(`### ${c.spec} — ${c.titulo}`, "");
    for (const a of c.arquivos) linhas.push(`- \`${a}\`${publicado.has(a) ? "" : " (não publicada: limite da rodada)"}`);
    linhas.push("");
  }
  if (restantes.length) {
    linhas.push(`## Não publicadas (${restantes.length}): passaram do limite da rodada`, "", "Estão no artifact `lab-diffs-<rodada>-fatia-<n>` do Actions.", "");
    for (const r of restantes) linhas.push(`- \`${r.caminho}\``);
    linhas.push("");
  }
  return linhas.join("\n");
}

/** Só o `lab-diffs`, e só quando o último commit tem mais de `dias` dias. Qualquer outro nome nunca entra. */
export function ramosParaApagar(refs, agoraMs, dias = DIAS_DE_GUARDA) {
  return refs.filter((r) => r.nome === RAMO && agoraMs - r.criadoEmMs > dias * DIA_MS).map((r) => r.nome);
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

function acharIndices(pasta) {
  const achados = [];
  if (!existsSync(pasta)) return achados;
  const varrer = (dir) => {
    for (const nome of readdirSync(dir).sort()) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) varrer(p);
      else if (nome === "indice.json") achados.push(p);
    }
  };
  varrer(pasta);
  return achados;
}

const numeroDoSpec = (spec) => Number(/^t(\d+)/.exec(spec)?.[1] ?? 1e9);

/**
 * Publica as imagens coletadas pelas fatias num commit órfão no branch `lab-diffs` (reescreve o branch).
 * Não toca na árvore de trabalho do checkout: monta a árvore num índice temporário.
 * @param {{ pasta: string, run: string, sha: string, ramo: string, repo?: string, remoto?: string, repositorio?: string, git?: RodarGit | null, geradoEm?: string }} opcoes
 * @returns {{ estado: "publicado" | "sem-imagens", commit: string, publicadas: number, restantes: number }}
 */
export function publicar({ pasta, run, sha, ramo, repo = process.cwd(), remoto = "origin", repositorio = "", git = null, geradoEm = "" }) {
  exigirRamo(ramo);
  const rodar = git ?? gitDe(repo);
  // Junta os índices das fatias; o mesmo caminho (mesmo teste em dois artifacts) entra uma vez só.
  const casosPorChave = new Map();
  const origemDe = new Map();
  for (const indice of acharIndices(pasta)) {
    let dados;
    try {
      dados = JSON.parse(readFileSync(indice, "utf8"));
    } catch {
      continue;
    }
    for (const c of dados.casos ?? []) {
      const chave = `${c.spec}|${c.titulo}|${c.projeto ?? ""}`;
      const caso = casosPorChave.get(chave) ?? { spec: c.spec, titulo: c.titulo, projeto: c.projeto ?? "", arquivos: [] };
      for (const a of c.arquivos ?? []) {
        const origem = join(dirname(indice), a);
        // Só PNG de verdade, e só dentro da pasta do próprio índice.
        if (relative(dirname(indice), origem).startsWith("..") || !ehPng(origem) || origemDe.has(a)) continue;
        origemDe.set(a, origem);
        caso.arquivos.push(a);
      }
      if (caso.arquivos.length) casosPorChave.set(chave, caso);
    }
  }
  const casos = [...casosPorChave.values()].sort((a, b) => numeroDoSpec(a.spec) - numeroDoSpec(b.spec) || a.spec.localeCompare(b.spec) || a.titulo.localeCompare(b.titulo));
  const imagens = casos.flatMap((c) => c.arquivos.map((a) => ({ caminho: a, bytes: statSync(origemDe.get(a)).size })));
  if (imagens.length === 0) return { estado: "sem-imagens", commit: "", publicadas: 0, restantes: 0 };
  const { publicadas, restantes } = selecionar(imagens);

  const montagem = mkdtempSync(join(tmpdir(), "lab-diffs-"));
  for (const p of publicadas) {
    mkdirSync(dirname(join(montagem, p.caminho)), { recursive: true });
    copyFileSync(origemDe.get(p.caminho), join(montagem, p.caminho));
  }
  writeFileSync(join(montagem, "README.md"), textoReadme({ run, sha, repositorio, casos, publicadas, restantes, geradoEm }));
  // O branch só tem imagens: a Vercel não deve tentar construir nada a partir dele.
  writeFileSync(join(montagem, "vercel.json"), `${JSON.stringify({ git: { deploymentEnabled: false } }, null, 2)}\n`);

  const env = {
    GIT_DIR: rodar(["rev-parse", "--absolute-git-dir"]),
    GIT_WORK_TREE: montagem,
    GIT_INDEX_FILE: join(mkdtempSync(join(tmpdir(), "lab-diffs-indice-")), "index"),
    GIT_AUTHOR_NAME: "lab-diffs (laboratório)",
    GIT_AUTHOR_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com",
    GIT_COMMITTER_NAME: "lab-diffs (laboratório)",
    GIT_COMMITTER_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com",
  };
  rodar(["add", "-A", "--force", "."], { cwd: montagem, env });
  const arvore = rodar(["write-tree"], { cwd: montagem, env });
  const commit = rodar(["commit-tree", arvore, "-m", `lab-diffs: rodada ${run} (commit ${sha})`], { cwd: montagem, env });
  // Reescreve SÓ refs/heads/lab-diffs (o nome já foi conferido acima).
  rodar(["push", "--quiet", remoto, `+${commit}:refs/heads/${RAMO}`]);
  return { estado: "publicado", commit, publicadas: publicadas.length, restantes: restantes.length };
}

/**
 * Apaga o `lab-diffs` do remoto quando o último commit dele tem mais de `dias` dias. Só esse nome.
 * @param {{ ramo: string, repo?: string, remoto?: string, dias?: number, agora?: number, git?: RodarGit | null }} opcoes
 * @returns {{ apagados: string[] }}
 */
export function limpar({ ramo, repo = process.cwd(), remoto = "origin", dias = DIAS_DE_GUARDA, agora = Date.now(), git = null }) {
  exigirRamo(ramo);
  const rodar = git ?? gitDe(repo);
  if (!rodar(["ls-remote", "--heads", remoto, `refs/heads/${RAMO}`])) return { apagados: [] };
  const temporaria = "refs/lab-diffs-limpeza/atual";
  rodar(["fetch", "--quiet", "--no-tags", "--depth=1", remoto, `+refs/heads/${RAMO}:${temporaria}`]);
  const criadoEmMs = Number(rodar(["log", "-1", "--format=%ct", temporaria])) * 1000;
  rodar(["update-ref", "-d", temporaria]);
  const apagados = [];
  for (const nome of ramosParaApagar([{ nome: RAMO, criadoEmMs }], agora, dias)) {
    exigirRamo(nome);
    rodar(["push", "--quiet", remoto, "--delete", `refs/heads/${nome}`]);
    apagados.push(nome);
  }
  return { apagados };
}

function principal() {
  const [comando, ...resto] = process.argv.slice(2);
  const opcao = (nome) => (resto.indexOf(nome) >= 0 ? resto[resto.indexOf(nome) + 1] : undefined);
  const posicionais = resto.filter((a, i) => !a.startsWith("--") && !String(resto[i - 1]).startsWith("--"));
  try {
    if (comando === "coletar") {
      const [resultado, destino] = posicionais;
      if (!resultado || !destino) throw new Error("uso: diffs-visuais.mjs coletar <resultado.json> <destino>");
      if (!existsSync(resultado)) return console.log("diffs visuais: sem resultado.json (a suíte não gravou o relatório); nada a coletar.");
      const r = coletar(JSON.parse(readFileSync(resultado, "utf8")), destino);
      console.log(r.imagens ? `diffs visuais: ${r.imagens} imagem(ns) de ${r.casos} teste(s) visual(is) que falharam, em ${destino}/` : "diffs visuais: nenhum teste visual falhou nesta fatia; nada a guardar.");
    } else if (comando === "publicar") {
      const [pasta] = posicionais;
      const r = publicar({ pasta, run: opcao("--run") ?? "?", sha: opcao("--sha") ?? "?", ramo: opcao("--ramo") ?? "", repositorio: opcao("--repositorio") ?? "" });
      console.log(
        r.estado === "publicado"
          ? `lab-diffs: ${r.publicadas} imagem(ns) publicada(s) no branch ${RAMO} (commit ${r.commit})${r.restantes ? `; ${r.restantes} ficaram de fora pelo limite e estão listadas no README` : ""}.`
          : "lab-diffs: nenhuma falha visual nesta rodada; o branch não foi tocado.",
      );
    } else if (comando === "limpar") {
      const r = limpar({ ramo: opcao("--ramo") ?? "", dias: Number(opcao("--dias") ?? DIAS_DE_GUARDA) });
      console.log(r.apagados.length ? `lab-diffs: branch ${RAMO} apagado (último commit com mais de ${opcao("--dias") ?? DIAS_DE_GUARDA} dias).` : `lab-diffs: nada a apagar.`);
    } else {
      throw new Error("uso: diffs-visuais.mjs coletar|publicar|limpar …");
    }
  } catch (e) {
    console.error(`::error::${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) principal();
