/*
  Frente 0 (11/11/2026) — a rodada do laboratório rodou TODOS os testes?
  As rodadas agendadas de 10/11 e 11/11 executaram ~610 testes e pularam ~3.900 (teto global estourado num job só) e
  o job ficou "verde por omissão". Aqui o consolidar compara a listagem do mesmo commit (`playwright test --list
  --reporter=json`, gerada no job construir) com o resultado juntado das fatias:

    executado       = o teste rodou até o fim (passou, falhou, instável ou falha conhecida);
    pulo declarado  = test.skip()/test.fixme() de propósito (expectedStatus "skipped");
    não executado   = listado e: ausente do relatório (fatia perdida), "skipped" sem ter sido declarado (cortado pelo
                      teto global ou nunca começou).

    fora da listagem = rodou até o fim e NÃO está na listagem do commit (E744, 15/11): listagem e rodada não falam do
                      mesmo conjunto. Caso real: o t337 montava a lista de testes com um arquivo que só existe depois do
                      seed da fatia (24 testes listados, 27 rodados, 4 "não executados" falsos por noite).

    não iniciado por infraestrutura (ORDEM-DUET-149) = listado, não rodou, e está num infra.json de alguma fatia: a
                      instalação do navegador dele falhou (scripts/lab/infra-navegador.mjs). Vai para um balde próprio,
                      com a corrida, o job e o passo; não conta como "não executado".

  Completa = nenhum "não executado" (executados + pulos declarados = listados) e nenhum "fora da listagem".
  Incompleta deixa o job vermelho.

  Uso: node scripts/lab/conferir-completude.mjs <lista.json> <resultado.json> [--saida numeros.json] [--infra <pasta das fatias>]
  Imprime um resumo em Markdown (vai para o resumo da rodada) e sai com 1 se faltar algum teste.
*/
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
export function completude(listagem, rodada, infra = []) {
  const daInfra = new Map(infra.map((i) => [i.chave, i]));
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
  const naoIniciadosPorInfra = [];
  for (const l of listados) {
    const r = daRodada.get(l.chave);
    if (r?.executado) executados++;
    else if (r?.declarado) pulosDeclarados++;
    else if (daInfra.has(l.chave)) naoIniciadosPorInfra.push(daInfra.get(l.chave));
    else naoExecutados.push(l.chave);
  }
  naoIniciadosPorInfra.sort((a, b) => a.chave.localeCompare(b.chave));
  naoExecutados.sort();
  const naListagem = new Set(listados.map((l) => l.chave));
  const foraDaListagem = [...daRodada.values()].filter((t) => t.executado && !naListagem.has(t.chave)).map((t) => t.chave).sort();
  const ok = listados.length > 0 && naoExecutados.length === 0 && foraDaListagem.length === 0;
  return { listados: listados.length, executados, pulosDeclarados, naoExecutados, foraDaListagem, naoIniciadosPorInfra, ok };
}

export function textoCompletude(c) {
  const fora = c.foraDaListagem ?? [];
  const infra = c.naoIniciadosPorInfra ?? [];
  const linhas = [
    "### Completude da rodada",
    `Listados ${c.listados} · executados ${c.executados} · pulados de propósito ${c.pulosDeclarados} · NÃO executados ${c.naoExecutados.length} · fora da listagem ${fora.length} · não iniciados por infraestrutura ${infra.length}`,
  ];
  if (c.listados === 0) linhas.push("", "❌ Sem a listagem do commit: não dá para provar que a rodada foi completa.");
  else if (c.naoExecutados.length === 0 && fora.length === 0) linhas.push("", "✅ Todos os testes listados rodaram (ou estão pulados de propósito).");
  else if (c.naoExecutados.length > 0) {
    linhas.push("", `❌ ${c.naoExecutados.length} teste(s) listado(s) não rodaram (teto global, fatia perdida ou teste que nunca começou):`);
    for (const k of c.naoExecutados.slice(0, 50)) linhas.push(`- ${k}`);
    if (c.naoExecutados.length > 50) linhas.push(`- … e mais ${c.naoExecutados.length - 50}`);
  }
  if (fora.length > 0) {
    linhas.push(
      "",
      `❌ ${fora.length} teste(s) rodaram sem estar na listagem do commit. A lista de testes de um spec não pode depender de arquivo ou dado que só existe na fatia (seed, massa, conta):`,
    );
    for (const k of fora.slice(0, 50)) linhas.push(`- ${k}`);
    if (fora.length > 50) linhas.push(`- … e mais ${fora.length - 50}`);
  }
  if (infra.length > 0) {
    // ORDEM-DUET-151: o balde é visibilidade, não é passe.
    linhas.push(
      "",
      "🟡 VERDE COM RESSALVA DE INFRAESTRUTURA: esta corrida não conta para as 3 verdes seguidas enquanto o balde abaixo não estiver vazio ou cada teste dele não tiver disposição escrita do Gerente.",
    );
    linhas.push("", `⚠️ ${infra.length} teste(s) não iniciados por infraestrutura (a instalação do navegador falhou na fatia; não são falha nem regressão):`);
    for (const i of infra.slice(0, 50)) linhas.push(`- ${i.chave} — corrida ${i.corrida} · job ${i.job} · passo ${i.passo}`);
    if (infra.length > 50) linhas.push(`- … e mais ${infra.length - 50}`);
  }
  return linhas.join("\n");
}

/** Junta os infra.json de todas as fatias (artifacts baixados em <pasta>/<artifact>/.../infra.json). */
export function lerInfra(pasta) {
  const saida = [];
  const varrer = (dir) => {
    if (!dir || !existsSync(dir)) return;
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) varrer(caminho);
      else if (nome === "infra.json") {
        try {
          saida.push(...JSON.parse(readFileSync(caminho, "utf8")));
        } catch {
          /* infra.json ilegível: o teste fica como "não executado", que é o lado seguro */
        }
      }
    }
  };
  varrer(pasta);
  return saida;
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
  const iInfra = args.indexOf("--infra");
  const pastaInfra = iInfra >= 0 ? args[iInfra + 1] : null;
  const [lista, resultado] = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--saida" && args[i - 1] !== "--infra");
  if (!lista || !resultado) {
    console.error("uso: conferir-completude.mjs <lista.json> <resultado.json> [--saida numeros.json]");
    process.exit(2);
  }
  const c = completude(lerJson(lista), lerJson(resultado), pastaInfra ? lerInfra(pastaInfra) : []);
  if (saida) writeFileSync(saida, JSON.stringify({ listados: c.listados, executados: c.executados, nao_executados: c.naoExecutados.length, fora_da_listagem: c.foraDaListagem.length, nao_iniciados_infra: c.naoIniciadosPorInfra.length }));
  console.log(textoCompletude(c));
  if (!c.ok) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) principal();
