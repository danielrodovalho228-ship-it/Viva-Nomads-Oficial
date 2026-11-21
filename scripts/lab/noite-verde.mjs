/*
  E744, T4 (plano de 17/11/2026) — a rodada do laboratório foi uma NOITE VERDE?

  Uma rodada é VERDE quando:
    - a completude fecha (executados + pulos declarados = listados; nada rodou fora da listagem);
    - há ZERO falhas fora de "conhecida" e de "quarentena";
    - há ZERO instáveis fora de "quarentena".
  As conhecidas e a quarentena aparecem sempre no relatório, com contagem. A meta é 3 noites agendadas verdes seguidas.

  Classes de um teste das fatias que bloqueiam (a quarentena roda fora delas e não entra no veredito):
    passou        rodou e passou de primeira;
    pulou         test.skip()/test.fixme() de propósito;
    conhecida     test.fail() que falhou como esperado: defeito real com item (anotação { type: "defeito", description: "E…" });
    instável      passou só na nova tentativa;
    falhou        o resto que rodou. O que é de um spec sem disposição em tests/laboratorio/disposicao-falhas.json
                  conta também em "sem disposição";
    não iniciado  nunca começou (cadeia em série depois de uma falha, corte pelo teto): quem acusa é a completude.

  Uso (job consolidar):
    node scripts/lab/noite-verde.mjs <resultado.json> --completude numeros.json --quarentena quarentena.json
         --disposicoes tests/laboratorio/disposicao-falhas.json --por-fatia por-fatia.json --historico historico.json
         --gatilho schedule [--saida noite.json]
  Imprime o relatório do dia em Markdown e grava o JSON que vai para lab_execucoes.noite. Não reprova a rodada: o vermelho
  do job continua vindo das fatias, da completude e das regressões.
*/
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

export const META_DE_NOITES = 3;

/** Conta as classes dos testes de um relatório JSON do Playwright (o das fatias, já juntado). */
export function classesDaRodada(relatorio, disposicoes = []) {
  const comDisposicao = new Set((disposicoes ?? []).map((d) => d.spec));
  const c = { passou: 0, pulou: 0, conhecida: 0, instavel: 0, falhou: 0, sem_disposicao: 0, nao_iniciado: 0, conhecidas_por_item: {}, specs_sem_disposicao: [] };
  const semDisposicao = new Set();
  const varrer = (suites, arquivoPai) => {
    for (const s of suites ?? []) {
      const arquivo = s.file ?? arquivoPai ?? "";
      for (const spec of s.specs ?? []) {
        const nome = basename(spec.file ?? arquivo);
        for (const t of spec.tests ?? []) {
          const declarado = t.expectedStatus === "skipped";
          const rodou = (t.results ?? []).length > 0 && t.status !== "skipped";
          if (declarado) c.pulou++;
          else if (!rodou) c.nao_iniciado++;
          else if (t.status === "flaky") c.instavel++;
          else if (t.status === "unexpected") {
            c.falhou++;
            if (!comDisposicao.has(nome)) {
              c.sem_disposicao++;
              semDisposicao.add(nome);
            }
          } else if (t.expectedStatus === "failed") {
            c.conhecida++;
            const item = (t.annotations ?? []).find((a) => a?.type === "defeito")?.description ?? "sem item";
            c.conhecidas_por_item[item] = (c.conhecidas_por_item[item] ?? 0) + 1;
          } else c.passou++;
        }
      }
      varrer(s.suites, arquivo);
    }
  };
  varrer(relatorio?.suites, undefined);
  const ordem = (a) => Number((a.match(/^t(\d+)/) ?? [])[1] ?? 99999);
  c.specs_sem_disposicao = [...semDisposicao].sort((a, b) => ordem(a) - ordem(b) || a.localeCompare(b));
  return c;
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** O veredito da noite, com os motivos quando não é verde e os números por classe que vão para o banco. */
export function noiteVerde({ classes, completude, quarentena }) {
  const motivos = [];
  const listados = Number(completude?.listados ?? 0);
  const naoExecutados = Number(completude?.nao_executados ?? 0);
  const foraDaListagem = Number(completude?.fora_da_listagem ?? 0);
  if (!(listados > 0)) motivos.push("completude não conferida: rodada sem a listagem do commit");
  else if (naoExecutados > 0 || foraDaListagem > 0) {
    const partes = [];
    if (naoExecutados > 0) partes.push(plural(naoExecutados, "listado não rodou", "listados não rodaram"));
    if (foraDaListagem > 0) partes.push(plural(foraDaListagem, "rodou fora da listagem", "rodaram fora da listagem"));
    motivos.push(`completude não fechou: ${partes.join(" e ")}`);
  }
  if (classes.falhou > 0) {
    const sem = classes.sem_disposicao > 0 ? ` (${classes.sem_disposicao} ${classes.sem_disposicao === 1 ? "dela" : "delas"} sem disposição)` : "";
    motivos.push(`${plural(classes.falhou, "falha", "falhas")} fora de "conhecida" e de "quarentena"${sem}`);
  }
  if (classes.instavel > 0) motivos.push(`${plural(classes.instavel, "instável", "instáveis")} fora da quarentena`);
  return {
    estado: motivos.length === 0 ? "verde" : "vermelha",
    motivos,
    classes: { falhou: classes.falhou, conhecida: classes.conhecida, quarentena: Number(quarentena?.tamanho ?? 0), instavel: classes.instavel, sem_disposicao: classes.sem_disposicao },
  };
}

/**
  Noites agendadas verdes seguidas. `anteriores` são os estados das noites AGENDADAS já gravadas, da mais nova para a mais
  velha (null = noite sem estado gravado, anterior à T4: quebra a sequência). `hoje`, quando a rodada de agora é agendada,
  entra na frente; rodada manual não soma nem zera.
*/
export function sequenciaDeNoitesVerdes(anteriores, hoje) {
  const estados = hoje?.gatilho === "schedule" ? [hoje.estado, ...(anteriores ?? [])] : [...(anteriores ?? [])];
  let n = 0;
  for (const e of estados) {
    if (e !== "verde") break;
    n++;
  }
  return n;
}

/** O relatório diário, em Markdown: é o que o Gerente leva ao Daniel. */
export function textoDoRelatorio({ noite, classes, completude, quarentena, fatias, sequencia, gatilho, data }) {
  const verde = noite.estado === "verde";
  const q = quarentena ?? {};
  const linhas = [
    `## Relatório da noite — ${data}: ${verde ? "🟢 VERDE" : "🔴 VERMELHA"}`,
    "",
    `Fatias completas: ${fatias?.completas ?? "?"} de ${fatias?.esperadas ?? "?"} · Listados ${completude?.listados ?? "?"} · executados ${completude?.executados ?? "?"} · não executados ${completude?.nao_executados ?? "?"}`,
    "",
    "| Classe | Testes |",
    "|---|---|",
    `| Passou | ${classes.passou} |`,
    `| Falhou | ${classes.falhou} |`,
    `| — das quais sem disposição | ${classes.sem_disposicao} |`,
    `| Instável (fora da quarentena) | ${classes.instavel} |`,
    `| Conhecida (defeito com item) | ${classes.conhecida} |`,
    `| Quarentena | ${q.tamanho ?? 0} de 25 |`,
    `| Pulou de propósito | ${classes.pulou} |`,
    "",
  ];
  const itens = Object.entries(classes.conhecidas_por_item ?? {}).sort((a, b) => a[0].localeCompare(b[0], "pt", { numeric: true }));
  linhas.push(`Conhecidas por item: ${itens.length ? itens.map(([item, n]) => `${item} (${n})`).join(", ") : "nenhuma"}`);
  linhas.push(`Quarentena: ${q.tamanho ?? 0} entradas, ${q.vencidas ?? 0} vencidas, ${q.candidatas ?? 0} passaram 3 de 3 (candidatas a sair), ${q.nao_rodaram ?? 0} não rodaram`);
  if (classes.specs_sem_disposicao?.length) linhas.push(`Sem disposição: ${classes.specs_sem_disposicao.join(", ")}`);
  linhas.push("");
  if (!verde) {
    linhas.push("Por que não é verde:");
    for (const m of noite.motivos) linhas.push(`- ${m}`);
    linhas.push("");
  }
  const meta = sequencia >= META_DE_NOITES ? " — meta atingida" : "";
  const manual = gatilho === "schedule" ? "" : " · rodada manual: não conta para a sequência";
  linhas.push(`Noites verdes seguidas: ${sequencia} (meta: ${META_DE_NOITES})${meta}${manual}`);
  return linhas.join("\n");
}

function lerJson(caminho, padrao) {
  if (!caminho || !existsSync(caminho)) return padrao;
  try {
    return JSON.parse(readFileSync(caminho, "utf8"));
  } catch {
    return padrao;
  }
}

function principal() {
  const args = process.argv.slice(2);
  const opcao = (nome) => {
    const i = args.indexOf(`--${nome}`);
    return i >= 0 ? args[i + 1] : null;
  };
  const resultado = args.find((a, i) => !a.startsWith("--") && !(args[i - 1] ?? "").startsWith("--"));
  if (!resultado) {
    console.error("uso: noite-verde.mjs <resultado.json> --completude … --quarentena … --disposicoes … --por-fatia … --historico … --gatilho … [--saida …]");
    process.exit(2);
  }
  const disposicoes = lerJson(opcao("disposicoes"), {})?.disposicoes ?? [];
  const classes = classesDaRodada(lerJson(resultado, { suites: [] }), disposicoes);
  const completude = lerJson(opcao("completude"), {});
  const quarentena = lerJson(opcao("quarentena"), null);
  const noite = noiteVerde({ classes, completude, quarentena });
  const gatilho = opcao("gatilho") ?? "";
  // historico.json: ["verde", "vermelha", null, …] das noites agendadas anteriores, da mais nova para a mais velha.
  const historico = lerJson(opcao("historico"), []);
  const sequencia = sequenciaDeNoitesVerdes(Array.isArray(historico) ? historico : [], { estado: noite.estado, gatilho });
  const porFatia = lerJson(opcao("por-fatia"), []);
  const linhasDasFatias = Array.isArray(porFatia) ? porFatia : (porFatia?.fatias ?? []);
  const fatias = { esperadas: linhasDasFatias.length, completas: linhasDasFatias.filter((f) => f.entregou !== false && Number(f.naoIniciados ?? 0) === 0).length };
  const saida = opcao("saida");
  if (saida) writeFileSync(saida, JSON.stringify({ ...noite, sequencia, conhecidas_por_item: classes.conhecidas_por_item, specs_sem_disposicao: classes.specs_sem_disposicao, quarentena: quarentena ? { tamanho: quarentena.tamanho, vencidas: quarentena.vencidas, candidatas: quarentena.candidatas, nao_rodaram: quarentena.nao_rodaram } : null }));
  console.log(textoDoRelatorio({ noite, classes, completude, quarentena, fatias, sequencia, gatilho, data: new Date().toISOString().slice(0, 10) }));
}

if (import.meta.url === `file://${process.argv[1]}`) principal();
