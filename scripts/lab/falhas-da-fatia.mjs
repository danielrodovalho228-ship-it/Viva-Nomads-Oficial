/*
  E744 (15/11/2026) — números e falhas de UMA fatia, impressos no log do próprio job.

  Por quê: o erro de cada falha ia para dois lugares. O banco (public.lab_execucoes) guarda só os primeiros 300 caracteres,
  e o relatório completo fica no artifact da fatia, que nem toda sessão consegue baixar. Na rodada manual de 15/11 nove
  varreduras acusaram um cartão da busca "coberto por elemento fixo (butt…": o nome do elemento ficou cortado e não havia
  como ler o resto. O log do job é legível pela API do GitHub; aqui cada teste que falhou (ou ficou instável) sai com o
  erro inteiro, até 2.000 caracteres, com as mesmas máscaras do resumo (sem cor de terminal, sequências longas viram ***).

  Uso: node scripts/lab/falhas-da-fatia.mjs <resultado.json> <número da fatia>
  Só imprime. Não reprova nem aprova nada: o veredito da fatia continua no passo "Marcar a fatia como falha".
*/
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { numerosDaFatia } from "./numeros-por-fatia.mjs";
import { trechoDoErro } from "./resumo-specs.mjs";

export const TETO_DO_ERRO = 2000;

/** Testes que falharam ou ficaram instáveis: [{ arquivo, titulo, status, erro }], na ordem do relatório. */
export function falhasDaFatia(relatorio) {
  const saida = [];
  const varrer = (suites, arquivoPai) => {
    for (const s of suites ?? []) {
      const arquivo = s.file ?? arquivoPai ?? "";
      for (const spec of s.specs ?? []) {
        for (const t of spec.tests ?? []) {
          const status = t.status === "unexpected" ? "falhou" : t.status === "flaky" ? "instavel" : null;
          if (!status) continue;
          saida.push({ arquivo: basename(spec.file ?? arquivo), titulo: spec.title, status, erro: trechoDoErro(t.results, status === "instavel", TETO_DO_ERRO) });
        }
      }
      varrer(s.suites, arquivo);
    }
  };
  varrer(relatorio?.suites, "");
  return saida;
}

const min = (m) => m.toFixed(1).replace(".", ",");

export function textoFalhasDaFatia(relatorio, fatia) {
  const n = numerosDaFatia(relatorio);
  const linhas = [
    `FATIA ${fatia} — listados ${n.listados} · executados ${n.executados} · passaram ${n.passou} · falharam ${n.falhou} · instáveis ${n.instavel} · pulados de propósito ${n.pulosDeclarados} · não iniciados ${n.naoIniciados} · suíte ${min(n.minutos)} min`,
  ];
  const falhas = falhasDaFatia(relatorio);
  if (falhas.length === 0) linhas.push("Nenhuma falha nesta fatia.");
  for (const f of falhas) linhas.push("", `FALHA | ${f.status} | ${f.arquivo} | ${f.titulo}`, f.erro || "(sem mensagem de erro no relatório)");
  return linhas.join("\n");
}

function principal() {
  const [caminho, fatia] = process.argv.slice(2);
  if (!caminho || !existsSync(caminho)) {
    console.log(`FATIA ${fatia ?? "?"} — sem resultado.json (a suíte não chegou a gravar o relatório).`);
    return;
  }
  console.log(textoFalhasDaFatia(JSON.parse(readFileSync(caminho, "utf8")), fatia ?? "?"));
}

if (import.meta.url === `file://${process.argv[1]}`) principal();
