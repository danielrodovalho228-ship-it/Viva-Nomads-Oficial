/*
  E744 (15/11/2026) — números da rodada POR FATIA, para o resumo do job consolidar.

  O resumo trazia os totais e a lista por spec, mas não dizia quantos testes cada fatia tinha, quantos rodou, quantos
  falharam e quanto demorou: para saber, era preciso refazer o mapa teste → fatia à mão (`--list --shard=N/16`).
  Aqui cada resultado.json (um por artifact de fatia) vira uma linha:

    listados            = testes que o Playwright entregou à fatia (o relatório do --shard só traz os dela);
    executados          = rodaram até o fim (passou, falhou, instável ou falha conhecida);
    pulados de propósito = test.skip()/test.fixme() (expectedStatus "skipped");
    não iniciados       = listados na fatia que não rodaram e não são pulo declarado (cadeia em série depois de uma
                          falha, ou corte pelo teto global);
    suíte (min)         = stats.duration do relatório (o tempo do `playwright test`, sem o preparo do job).

  Veredito: "vermelha" se algum teste falhou; "incompleta" se nada falhou mas algo não iniciou; "verde" no resto;
  "sem resultado" quando a fatia esperada não entregou o arquivo (runner morreu antes de gravar).

  Uso: node scripts/lab/numeros-por-fatia.mjs <pasta-com-as-fatias> [--esperadas N] [--saida por-fatia.json]
  Imprime a tabela em Markdown. Não reprova a rodada: quem decide o vermelho são as fatias, a completude e o detector.
*/
import { readFileSync, writeFileSync } from "node:fs";
import { acharResultados } from "./juntar-resultados.mjs";

/** Números de UM relatório JSON do Playwright (o de uma fatia). */
export function numerosDaFatia(relatorio) {
  const n = { listados: 0, executados: 0, passou: 0, falhou: 0, instavel: 0, pulosDeclarados: 0, naoIniciados: 0, minutos: 0 };
  const varrer = (suites) => {
    for (const s of suites ?? []) {
      for (const spec of s.specs ?? []) {
        for (const t of spec.tests ?? []) {
          n.listados++;
          const declarado = t.expectedStatus === "skipped";
          const rodou = (t.results ?? []).length > 0 && t.status !== "skipped";
          if (declarado) n.pulosDeclarados++;
          else if (!rodou) n.naoIniciados++;
          else {
            n.executados++;
            if (t.status === "unexpected") n.falhou++;
            else if (t.status === "flaky") n.instavel++;
            else n.passou++; // "expected": passou, ou falhou como o test.fail() declarava (falha conhecida)
          }
        }
      }
      varrer(s.suites);
    }
  };
  varrer(relatorio?.suites);
  const ms = Number(relatorio?.stats?.duration ?? 0);
  n.minutos = Math.round((Number.isFinite(ms) ? ms : 0) / 6000) / 10;
  return n;
}

/** Número da fatia pelo caminho do artifact (…/laboratorio-<run>-fatia-<n>/…/resultado.json). */
export function fatiaDoCaminho(caminho) {
  const m = /fatia-(\d+)/.exec(caminho);
  return m ? Number(m[1]) : null;
}

/** Uma linha por fatia, em ordem numérica; as esperadas (1..N) que não entregaram resultado entram com entregou=false. */
export function numerosPorFatia(pasta, esperadas = 0) {
  const porFatia = new Map();
  for (const caminho of acharResultados(pasta)) {
    const fatia = fatiaDoCaminho(caminho);
    if (fatia === null) continue;
    try {
      porFatia.set(fatia, { fatia, entregou: true, ...numerosDaFatia(JSON.parse(readFileSync(caminho, "utf8"))) });
    } catch {
      porFatia.set(fatia, { fatia, entregou: false });
    }
  }
  for (let f = 1; f <= esperadas; f++) if (!porFatia.has(f)) porFatia.set(f, { fatia: f, entregou: false });
  return [...porFatia.values()].sort((a, b) => a.fatia - b.fatia);
}

const veredito = (l) => (!l.entregou ? "sem resultado" : l.falhou > 0 ? "vermelha" : l.naoIniciados > 0 ? "incompleta" : "verde");
const min = (m) => m.toFixed(1).replace(".", ",");

export function textoPorFatia(linhas) {
  const saida = [
    "### Por fatia (executados × listados)",
    "| Fatia | Listados | Executados | Passaram | Falharam | Instáveis | Pulados de propósito | Não iniciados | Suíte (min) | Veredito |",
    "|---|---|---|---|---|---|---|---|---|---|",
  ];
  const total = { listados: 0, executados: 0, passou: 0, falhou: 0, instavel: 0, pulosDeclarados: 0, naoIniciados: 0 };
  let maior = 0;
  for (const l of linhas) {
    if (!l.entregou) {
      saida.push(`| ${l.fatia} | — | — | — | — | — | — | — | — | sem resultado |`);
      continue;
    }
    for (const k of Object.keys(total)) total[k] += l[k];
    maior = Math.max(maior, l.minutos);
    saida.push(
      `| ${l.fatia} | ${l.listados} | ${l.executados} | ${l.passou} | ${l.falhou} | ${l.instavel} | ${l.pulosDeclarados} | ${l.naoIniciados} | ${min(l.minutos)} | ${veredito(l)} |`,
    );
  }
  const verdes = linhas.filter((l) => veredito(l) === "verde").length;
  saida.push(
    `| **Total** | ${total.listados} | ${total.executados} | ${total.passou} | ${total.falhou} | ${total.instavel} | ${total.pulosDeclarados} | ${total.naoIniciados} | maior: ${min(maior)} | ${verdes} de ${linhas.length} verdes |`,
  );
  return saida.join("\n");
}

function principal() {
  const args = process.argv.slice(2);
  const valor = (nome) => (args.indexOf(nome) >= 0 ? args[args.indexOf(nome) + 1] : null);
  const esperadas = Number(valor("--esperadas") ?? 0);
  const saida = valor("--saida");
  const [pasta] = args.filter((a, i) => !a.startsWith("--") && !["--esperadas", "--saida"].includes(args[i - 1]));
  if (!pasta) {
    console.error("uso: numeros-por-fatia.mjs <pasta-com-as-fatias> [--esperadas N] [--saida por-fatia.json]");
    process.exit(2);
  }
  const linhas = numerosPorFatia(pasta, Number.isFinite(esperadas) ? esperadas : 0);
  if (saida) writeFileSync(saida, JSON.stringify(linhas));
  console.log(textoPorFatia(linhas));
}

if (import.meta.url === `file://${process.argv[1]}`) principal();
