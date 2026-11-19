/*
  ORDEM-DUET-149, item 3: falha de INSTALAÇÃO de um navegador do Playwright numa fatia não é falha de teste.

  Caso real: corrida 44429658751, fatia 20. As 2 tentativas do `playwright install --with-deps webkit` esgotaram no apt, e
  os 10 testes do projeto webkit-iphone (t82, t151, t152) caíram com "browserType.launch: Executable doesn't exist". O
  consolidar contou-os como falhas e como regressão.

  Quando o passo de instalação do navegador falha, este script:
    - tira do resultado.json da fatia SÓ os testes desse projeto que caíram por falta do executável (o teste fica como
      não rodado: status "skipped", sem resultados) e desconta-os de stats.unexpected;
    - grava cada um em infra.json com a chave do teste, a corrida, o job e o passo, para o consolidar os pôr no balde
      "não iniciados por infraestrutura". Nada sai em silêncio.
  Falha de verdade do mesmo projeto (outro erro) fica onde está.

  Uso: node scripts/lab/infra-navegador.mjs <resultado.json> <infra.json> --projeto webkit-iphone --corrida <id> --job <nome> --passo <nome>
  Escreve `restam_falhas=true|false` em $GITHUB_OUTPUT (a fatia só deixa de ser vermelha se não restar nenhuma falha).
*/
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const FALTA_EXECUTAVEL = /browserType\.launch: Executable doesn't exist|Looks like Playwright was just installed or updated|Please run the following command to download new browsers/;

function caiuPorFaltaDoNavegador(teste) {
  const resultados = teste.results ?? [];
  return resultados.length > 0 && resultados.every((r) => r.status !== "passed" && FALTA_EXECUTAVEL.test(r.error?.message ?? ""));
}

/** Devolve { resultado, afetados, restamFalhas }. Não altera o objeto recebido. */
export function separarFalhasDeInfra(relatorio, { projeto, corrida, job, passo }) {
  const resultado = structuredClone(relatorio);
  const afetados = [];
  const varrer = (suites, caminho, arquivoPai) => {
    for (const s of suites ?? []) {
      const arquivo = s.file ?? arquivoPai ?? "";
      const titulo = s.title && s.title !== arquivo ? [...caminho, s.title] : caminho;
      for (const spec of s.specs ?? []) {
        for (const t of spec.tests ?? []) {
          if (t.projectName !== projeto || !caiuPorFaltaDoNavegador(t)) continue;
          const chave = [t.projectName, spec.file ?? arquivo, ...titulo, spec.title].filter(Boolean).join(" › ");
          afetados.push({ chave, corrida, job, passo });
          t.status = "skipped";
          t.results = [];
        }
      }
      varrer(s.suites, titulo, arquivo);
    }
  };
  varrer(resultado.suites, [], undefined);
  if (resultado.stats && typeof resultado.stats.unexpected === "number") {
    resultado.stats.unexpected = Math.max(0, resultado.stats.unexpected - afetados.length);
    resultado.stats.skipped = (resultado.stats.skipped ?? 0) + afetados.length;
  }
  const restamFalhas = (resultado.stats?.unexpected ?? 0) > 0;
  return { resultado, afetados, restamFalhas };
}

function principal() {
  const args = process.argv.slice(2);
  const opc = (nome) => {
    const i = args.indexOf(`--${nome}`);
    return i >= 0 ? args[i + 1] : "";
  };
  const [arqResultado, arqInfra] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
  if (!arqResultado || !arqInfra || !opc("projeto")) {
    console.error("uso: infra-navegador.mjs <resultado.json> <infra.json> --projeto <nome> --corrida <id> --job <nome> --passo <nome>");
    process.exit(2);
  }
  const relatorio = existsSync(arqResultado) ? JSON.parse(readFileSync(arqResultado, "utf8")) : { suites: [], stats: {} };
  const { resultado, afetados, restamFalhas } = separarFalhasDeInfra(relatorio, {
    projeto: opc("projeto"), corrida: opc("corrida"), job: opc("job"), passo: opc("passo"),
  });
  writeFileSync(arqResultado, JSON.stringify(resultado));
  const anteriores = existsSync(arqInfra) ? JSON.parse(readFileSync(arqInfra, "utf8")) : [];
  writeFileSync(arqInfra, JSON.stringify([...anteriores, ...afetados], null, 2));
  console.log(`### Não iniciados por infraestrutura (${opc("projeto")}): ${afetados.length}`);
  for (const a of afetados) console.log(`- ${a.chave} — corrida ${a.corrida} · job ${a.job} · passo ${a.passo}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `restam_falhas=${restamFalhas}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) principal();
