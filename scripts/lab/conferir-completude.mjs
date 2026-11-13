/*
  Frente 0 (11/11/2026) — a rodada do laboratório rodou TODOS os testes?
  As rodadas agendadas de 10/11 e 11/11 executaram ~610 testes e pularam ~3.900 (teto global estourado num job só) e
  o job ficou "verde por omissão". Aqui o consolidar compara a listagem do mesmo commit (`playwright test --list
  --reporter=json`, gerada no job construir) com o resultado juntado das fatias:

    executado       = o teste rodou até o fim (passou, falhou, instável ou falha conhecida);
    pulo declarado  = test.skip()/test.fixme() de propósito (expectedStatus "skipped");
    não executado   = listado e: ausente do relatório (fatia perdida), "skipped" sem ter sido declarado (cortado pelo
                      teto global ou nunca começou).

  Completa = nenhum "não executado" (executados + pulos declarados = listados). Incompleta deixa o job vermelho.

  Uso: node scripts/lab/conferir-completude.mjs <lista.json> <resultado.json> [--saida numeros.json]
  Imprime um resumo em Markdown (vai para o resumo da rodada) e sai com 1 se faltar algum teste.
*/
import { existsSync, readFileSync, writeFileSync } from "node:fs";

/** Todos os testes de um relatório JSON do Playwright, com chave estável "projeto › arquivo › describe › título". */
export function testesDoRelatorio(relatorio) {
  const saida = [];
  const varrer = (suites, caminho, arquivoPai) => {
    for (const s of suites ?? []) {
      const arquivo = s.file ?? arquivoPai ?? "";
      // A suíte-raiz de cada arquivo tem o próprio nome do arquivo como título: não repete no caminho.
      const titulo = s.title && s.title !== arquivo ? [...caminho, s.title] : caminho;
      for (const spec of s.specs ?? []) {
        for (const t of spec.tests ?? []) {
          const chave = [t.projectName ?? "", spec.file ?? arquivo, ...titulo, spec.title].filter(Boolean).join(" › ");
          const declarado = t.expectedStatus === "skipped";
          const rodou = (t.results ?? []).length > 0 && t.status !== "skipped";
          saida.push({ chave, declarado, executado: rodou && !declarado });
        }
      }
      varrer(s.suites, titulo, arquivo);
    }
  };
  varrer(relatorio?.suites, [], undefined);
  return saida;
}

/** Compara a listagem com a rodada. `ok` só quando há listagem e nenhum teste listado ficou sem rodar. */
export function completude(listagem, rodada) {
  const listados = testesDoRelatorio(listagem);
  const daRodada = new Map();
  for (const t of testesDoRelatorio(rodada)) {
    const antes = daRodada.get(t.chave);
    // A mesma chave pode vir de duas fatias só por engano de partição: vale a que rodou.
    if (!antes || t.executado || (t.declarado && !antes.executado)) daRodada.set(t.chave, t);
  }
  let executados = 0;
  let pulosDeclarados = 0;
  const naoExecutados = [];
  for (const l of listados) {
    const r = daRodada.get(l.chave);
    if (r?.executado) executados++;
    else if (r?.declarado) pulosDeclarados++;
    else naoExecutados.push(l.chave);
  }
  naoExecutados.sort();
  return { listados: listados.length, executados, pulosDeclarados, naoExecutados, ok: listados.length > 0 && naoExecutados.length === 0 };
}

export function textoCompletude(c) {
  const linhas = [
    "### Completude da rodada",
    `Listados ${c.listados} · executados ${c.executados} · pulados de propósito ${c.pulosDeclarados} · NÃO executados ${c.naoExecutados.length}`,
  ];
  if (c.listados === 0) linhas.push("", "❌ Sem a listagem do commit: não dá para provar que a rodada foi completa.");
  else if (c.naoExecutados.length === 0) linhas.push("", "✅ Todos os testes listados rodaram (ou estão pulados de propósito).");
  else {
    linhas.push("", `❌ ${c.naoExecutados.length} teste(s) listado(s) não rodaram (teto global, fatia perdida ou teste que nunca começou):`);
    for (const k of c.naoExecutados.slice(0, 50)) linhas.push(`- ${k}`);
    if (c.naoExecutados.length > 50) linhas.push(`- … e mais ${c.naoExecutados.length - 50}`);
  }
  return linhas.join("\n");
}

function lerJson(caminho) {
  if (!caminho || !existsSync(caminho)) return { suites: [] };
  try {
    return JSON.parse(readFileSync(caminho, "utf8"));
  } catch {
    return { suites: [] };
  }
}

function principal() {
  const args = process.argv.slice(2);
  const iSaida = args.indexOf("--saida");
  const saida = iSaida >= 0 ? args[iSaida + 1] : null;
  const [lista, resultado] = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--saida");
  if (!lista || !resultado) {
    console.error("uso: conferir-completude.mjs <lista.json> <resultado.json> [--saida numeros.json]");
    process.exit(2);
  }
  const c = completude(lerJson(lista), lerJson(resultado));
  if (saida) writeFileSync(saida, JSON.stringify({ listados: c.listados, executados: c.executados, nao_executados: c.naoExecutados.length }));
  console.log(textoCompletude(c));
  if (!c.ok) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) principal();
