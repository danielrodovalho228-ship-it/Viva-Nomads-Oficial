/*
  Resumo por spec do laboratório (para o resumo da execução no GitHub Actions).
  Lê o resultado.json do Playwright e imprime uma tabela em Markdown: uma linha
  por arquivo de teste (t1, t2, … t37), com passou / falhou / pulou / falha
  conhecida e o título de cada teste que falhou. O Moacir lê este resumo.

  Uso: node scripts/lab/resumo-specs.mjs tests/laboratorio/saida/resultado.json
  Com --json imprime {passou,falhou,pulou,instavel,por_spec,falhas} (gravado em
  public.lab_execucoes pela Action). Só títulos de testes, contagens e os primeiros 300 caracteres do erro (segredos mascarados).
  Sem o arquivo (a suíte nem chegou a rodar): avisa e sai sem erro.
*/
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";

const args = process.argv.slice(2);
const modoJson = args.includes("--json");
const caminho = args.find((a) => !a.startsWith("--")) ?? "tests/laboratorio/saida/resultado.json";

/**
 * Primeiros 300 caracteres da mensagem de erro da última tentativa, para diagnosticar sem abrir o GitHub.
 * Sem códigos de cor do terminal e sem sequências longas de letras/números (segredos TOTP, tokens): vão mascaradas.
 */
export function trechoDoErro(results) {
  const r = (results ?? []).at(-1);
  const bruto = String(r?.error?.message ?? r?.errors?.[0]?.message ?? "");
  const limpo = bruto.replace(/\u001b\[[0-9;]*m/g, "").replace(/[A-Za-z0-9_\-]{24,}/g, "***").replace(/\s+/g, " ").trim();
  return limpo.slice(0, 300);
}

/** Junta todos os testes de uma árvore de suites: [{ arquivo, titulo, status }]. */
export function coletar(suites, arquivoPai = "") {
  const saida = [];
  for (const s of suites ?? []) {
    const arquivo = s.file ?? arquivoPai;
    for (const spec of s.specs ?? []) {
      for (const t of spec.tests ?? []) {
        // "expected" com falha esperada (test.fail) = falha conhecida; "unexpected" = falhou; "skipped" = pulou.
        const falhaConhecida = t.expectedStatus === "failed" && t.status === "expected";
        const status = falhaConhecida ? "conhecida" : t.status === "expected" ? "passou" : t.status === "skipped" ? "pulou" : t.status === "flaky" ? "instavel" : "falhou";
        const item = { arquivo: basename(spec.file ?? arquivo), titulo: spec.title, status };
        if (status === "falhou" || status === "instavel") item.erro = trechoDoErro(t.results);
        saida.push(item);
      }
    }
    saida.push(...coletar(s.suites, arquivo));
  }
  return saida;
}

export function tabela(testes) {
  const porArquivo = new Map();
  for (const t of testes) {
    const l = porArquivo.get(t.arquivo) ?? { passou: 0, falhou: 0, pulou: 0, conhecida: 0, instavel: 0, falhas: [] };
    l[t.status]++;
    if (t.status === "falhou" || t.status === "instavel") l.falhas.push(t.erro ? `${t.titulo} — ${t.erro}` : t.titulo);
    porArquivo.set(t.arquivo, l);
  }
  const ordem = (a) => Number((a.match(/^t(\d+)/) ?? [])[1] ?? 999);
  const linhas = [...porArquivo.entries()].sort((a, b) => ordem(a[0]) - ordem(b[0]) || a[0].localeCompare(b[0]));
  const out = ["| Spec | Resultado | Passou | Falhou | Pulou | Falha conhecida |", "|---|---|---|---|---|---|"];
  for (const [arquivo, l] of linhas) {
    const resultado = l.falhou + l.instavel > 0 ? "❌ falhou" : l.passou === 0 && l.pulou > 0 && l.conhecida === 0 ? "⏭️ pulou" : "✅ passou";
    out.push(`| ${arquivo} | ${resultado} | ${l.passou} | ${l.falhou + l.instavel} | ${l.pulou} | ${l.conhecida} |`);
  }
  const falhas = linhas.flatMap(([arquivo, l]) => l.falhas.map((f) => `- ${arquivo}: ${f}`));
  if (falhas.length) out.push("", "Testes que falharam:", ...falhas);
  return out.join("\n");
}

/** Resumo para o banco: totais, contagem por arquivo e a lista de testes que falharam. */
export function resumoJson(testes) {
  const total = { passou: 0, falhou: 0, pulou: 0, instavel: 0 };
  const por_spec = {};
  const falhas = [];
  for (const t of testes) {
    const l = (por_spec[t.arquivo] ??= { passou: 0, falhou: 0, pulou: 0, instavel: 0, conhecida: 0 });
    l[t.status]++;
    if (t.status in total) total[t.status]++;
    if (t.status === "falhou" || t.status === "instavel") falhas.push({ spec: t.arquivo, titulo: t.titulo, status: t.status, erro: t.erro ?? "" });
  }
  return { ...total, por_spec, falhas };
}

if (process.argv[1] && process.argv[1].endsWith("resumo-specs.mjs")) {
  if (modoJson) {
    // Sem resultado.json a suíte nem rodou: registra 0 testes (a linha mostra o buraco).
    const dados = existsSync(caminho) ? JSON.parse(readFileSync(caminho, "utf8")) : { suites: [] };
    console.log(JSON.stringify(resumoJson(coletar(dados.suites))));
  } else if (!existsSync(caminho)) {
    console.log("Sem resultado.json: a suíte não chegou a rodar (veja os passos anteriores).");
  } else {
    const dados = JSON.parse(readFileSync(caminho, "utf8"));
    console.log(tabela(coletar(dados.suites)));
  }
}
