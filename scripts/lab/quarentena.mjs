/*
  E744, T2 (plano de 17/11/2026) — a quarentena formal dos testes instáveis do laboratório.

  O arquivo tests/laboratorio/quarentena.json tem uma entrada por teste:
    spec     o arquivo do teste (t29-chat-sem-aprovacao.spec.ts);
    titulo   o título do teste, como aparece no relatório;
    motivo   o que se viu (em quantas corridas, com que erro);
    item     o item de instabilidade (E<número>), que tem dono;
    dono     quem corrige;
    entrada  o dia em que entrou (AAAA-MM-DD);
    expira   o último dia de validade, no máximo 14 dias depois da entrada;
    correcao (opcional) o número do PR que corrige o teste, quando ele já existe;
    cadeiaDe (opcional) o título da entrada raiz do mesmo spec, quando este teste entra só por depender dela
             (cadeia em série: sem a raiz ele falha ou não roda). Entra e sai junto com a raiz.
  Entrada de spec inteira (decisão do Gerente, ORDEM-DUET-097, 18/11): quando os casos que falham dependem dos casos
  anteriores do mesmo spec, uma entrada só cobre o arquivo todo — `specInteira: true`, sem `titulo`, e `casos` com os
  títulos dos testes que falham. As fatias ficam sem o spec e o job da quarentena roda o arquivo com a cadeia intacta.
  Teto: 25 entradas. Entrada vencida, sem item, sem dono ou sem validade reprova o teste estático
  (tests/laboratorio/e744-t2-quarentena.test.ts).

  Regra de entrada: um teste com 2 instabilidades em rodadas diferentes vira item de instabilidade com dono, e só
  então pode entrar aqui. Desde 17/11 (decisão do Gerente, DUET-1225) entra também o teste velho que já tem correção
  escrita em PR aberto: a entrada aponta o PR em `correcao` e sai quando ele for mesclado, para a quarentena não
  mascarar a correção. E (DUET-1419) o defeito registrado, com item e dono, cuja falha não é sempre a mesma: entra
  com o item dele e sai no PR da correção. O defeito que falha sempre igual leva a marca de falha conhecida, não entra.

  O que a rodada faz com o arquivo:
    - as fatias bloqueantes rodam SEM esses testes (--grep-invert com o padrão daqui);
    - o job `quarentena`, que não bloqueia, roda só eles, com 1 worker e 3 repetições, sem nova tentativa;
    - o consolidar publica o tamanho da quarentena, as vencidas e as que passaram 3 de 3 (candidatas a sair).

  Uso:
    node scripts/lab/quarentena.mjs padrao                     imprime o padrão do --grep / --grep-invert (vazio sem entradas)
    node scripts/lab/quarentena.mjs validar                    lista os erros do arquivo; sai com 1 se houver
    node scripts/lab/quarentena.mjs resumo <resultado.json>    o resumo em Markdown do job da quarentena
                                     [--saida quarentena.json] e os números em JSON
*/
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const ARQUIVO = "tests/laboratorio/quarentena.json";
export const TETO = 25;
export const VALIDADE_MAXIMA_DIAS = 14;
const CAMPOS = ["spec", "titulo", "motivo", "item", "dono", "entrada", "expira"];
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 86_400_000;

/** As entradas do arquivo. Arquivo ausente ou sem a lista = quarentena vazia. */
export function lerQuarentena(caminho = ARQUIVO) {
  if (!existsSync(caminho)) return [];
  const dados = JSON.parse(readFileSync(caminho, "utf8"));
  return Array.isArray(dados?.entradas) ? dados.entradas : [];
}

const dia = (texto) => (DATA.test(String(texto)) ? Date.parse(`${texto}T00:00:00Z`) : NaN);
/** O que aparece no lugar do título: o do teste, ou "(spec inteira; falham: …)" na entrada que cobre o arquivo todo. */
const rotulo = (e) => (e?.specInteira === true ? `(spec inteira; falham: ${(Array.isArray(e.casos) ? e.casos : []).join("; ")})` : (e?.titulo ?? "?"));
const nome = (e, i) => (e?.spec ? `${e.spec} › ${rotulo(e)}` : `entrada ${i + 1}`);

/** As entradas que já passaram do último dia de validade. `hoje` é AAAA-MM-DD. */
export function vencidas(entradas, hoje) {
  return entradas.filter((e) => Number.isFinite(dia(e?.expira)) && dia(hoje) > dia(e.expira));
}

/**
  Os erros do arquivo, um texto por erro; lista vazia = válido.
  `opcoes.specExiste(spec)` confere o arquivo do spec (o teste estático passa; a rodada não precisa).
*/
export function validarQuarentena(entradas, hoje, opcoes = {}) {
  const erros = [];
  if (entradas.length > TETO) erros.push(`${entradas.length} entradas: passa do teto de ${TETO}`);
  const vistas = new Set();
  entradas.forEach((e, i) => {
    const quem = nome(e, i);
    const inteira = e?.specInteira === true;
    for (const campo of CAMPOS) if (!(inteira && campo === "titulo") && !String(e?.[campo] ?? "").trim()) erros.push(`${quem}: sem ${campo}`);
    if (inteira) {
      if (e.titulo !== undefined) erros.push(`${quem}: entrada de spec inteira não leva titulo`);
      if (!Array.isArray(e.casos) || e.casos.length === 0 || e.casos.some((c) => !String(c ?? "").trim())) erros.push(`${quem}: spec inteira sem os casos que falham`);
    } else if (e?.casos !== undefined) erros.push(`${quem}: casos só vale em entrada de spec inteira`);
    if (e?.item && !/^E\d+$/.test(e.item)) erros.push(`${quem}: item "${e.item}" não é E<número>`);
    if (e?.spec && !/\.spec\.ts$/.test(e.spec)) erros.push(`${quem}: spec "${e.spec}" não termina em .spec.ts`);
    for (const campo of ["entrada", "expira"]) if (e?.[campo] && !Number.isFinite(dia(e[campo]))) erros.push(`${quem}: data "${e[campo]}" em ${campo} não é AAAA-MM-DD`);
    const [de, ate] = [dia(e?.entrada), dia(e?.expira)];
    if (Number.isFinite(de) && Number.isFinite(ate)) {
      const dias = Math.round((ate - de) / DIA_MS);
      if (dias < 0) erros.push(`${quem}: expira antes da entrada`);
      else if (dias > VALIDADE_MAXIMA_DIAS) erros.push(`${quem}: validade de ${dias} dias, o máximo é ${VALIDADE_MAXIMA_DIAS}`);
      if (dia(hoje) > ate) erros.push(`${quem}: vencida em ${e.expira}`);
    }
    if (e?.correcao !== undefined && !(Number.isInteger(e.correcao) && e.correcao > 0)) erros.push(`${quem}: correcao "${e.correcao}" não é o número do PR`);
    const chave = inteira ? `${e?.spec} › *` : `${e?.spec} › ${e?.titulo}`;
    if (e?.spec && (inteira || e?.titulo) && vistas.has(chave)) erros.push(`${quem}: entrada repetida`);
    vistas.add(chave);
    // O spec que está inteiro na quarentena não tem também entradas por teste (e vice-versa).
    if (e?.spec && entradas.some((x) => x !== e && x?.spec === e.spec && (x?.specInteira === true) !== inteira)) erros.push(`${quem}: o spec já está inteiro na quarentena`);
    if (e?.spec && /\.spec\.ts$/.test(e.spec) && opcoes.specExiste && !opcoes.specExiste(e.spec)) erros.push(`${quem}: o spec ${e.spec} não existe`);
  });
  // Entrada de cadeia: aponta uma raiz do mesmo spec, com o mesmo item, que não é ela mesma de cadeia.
  entradas.forEach((e, i) => {
    if (e?.cadeiaDe === undefined) return;
    const quem = nome(e, i);
    const raiz = entradas.find((x) => x?.spec === e.spec && x?.titulo === e.cadeiaDe);
    if (!raiz) erros.push(`${quem}: cadeiaDe "${e.cadeiaDe}" não é uma entrada do mesmo spec`);
    else if (raiz.cadeiaDe !== undefined) erros.push(`${quem}: a entrada raiz também é de cadeia`);
    else if (raiz.item !== e.item) erros.push(`${quem}: item diferente do da entrada raiz`);
  });
  return erros;
}

const literal = (texto) => String(texto).replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");

/**
  O padrão que casa só os testes em quarentena, para o --grep (job da quarentena) e o --grep-invert (fatias).
  O Playwright compara com "projeto arquivo describes título etiquetas", separados por espaço. Cada entrada vira
  "<arquivo> (qualquer describe) <título>" seguido do fim do texto ou de uma etiqueta (@…): o título inteiro, no spec dela.
  Sem entradas devolve "": padrão vazio casaria tudo, então o workflow só passa a opção quando há texto.
*/
export function padraoDaQuarentena(entradas) {
  // Entrada de spec inteira: o arquivo e mais nada — casa todos os testes dele.
  const partes = entradas.map((e) => (e.specInteira === true ? `${literal(e.spec)}( |$)` : `${literal(e.spec)} (.* )?${literal(e.titulo)}( @|$)`));
  if (partes.length === 0) return "";
  return `(^| )(${partes.join("|")})`;
}

/** Os testes de um relatório JSON do Playwright: [{ spec, titulo, status }], uma linha por repetição. */
function testesDoRelatorio(relatorio) {
  const saida = [];
  const varrer = (suites, arquivoPai) => {
    for (const s of suites ?? []) {
      const arquivo = s.file ?? arquivoPai ?? "";
      for (const spec of s.specs ?? []) {
        for (const t of spec.tests ?? []) saida.push({ spec: String(spec.file ?? arquivo).split("/").pop(), titulo: spec.title, status: t.status, rodou: (t.results ?? []).length > 0 && t.status !== "skipped" });
      }
      varrer(s.suites, arquivo);
    }
  };
  varrer(relatorio?.suites, undefined);
  return saida;
}

/**
  O que o job da quarentena viu, entrada por entrada: quantas repetições rodaram e quantas passaram de primeira.
  "Passou" é só o status "expected": o que passou na nova tentativa (flaky) não conta.
*/
export function resultadoDaQuarentena(entradas, relatorio, hoje) {
  const testes = testesDoRelatorio(relatorio);
  const fora = new Set(vencidas(entradas, hoje));
  const linhas = entradas.map((e) => {
    // A entrada de spec inteira conta todas as repetições de todos os casos do arquivo.
    const dele = testes.filter((t) => t.spec === e.spec && (e.specInteira === true || t.titulo === e.titulo) && t.rodou);
    return { spec: e.spec, titulo: rotulo(e), item: e.item, dono: e.dono, expira: e.expira, rodou: dele.length, passou: dele.filter((t) => t.status === "expected").length, vencida: fora.has(e) };
  });
  return {
    tamanho: entradas.length,
    teto: TETO,
    linhas,
    vencidas: linhas.filter((l) => l.vencida),
    candidatas: linhas.filter((l) => l.rodou >= 3 && l.passou === l.rodou),
    naoRodaram: linhas.filter((l) => l.rodou === 0),
  };
}

/** O bloco "Quarentena" do resumo da rodada, em Markdown. Aparece sempre, mesmo vazia. */
export function textoDaQuarentena(r) {
  const linhas = [
    "### Quarentena",
    `${r.tamanho} de ${r.teto} entradas · Vencidas: ${r.vencidas.length} · Passaram 3 de 3 (candidatas a sair): ${r.candidatas.length} · Não rodaram: ${r.naoRodaram.length}`,
  ];
  if (r.tamanho === 0) return [...linhas, "", "Nenhum teste em quarentena."].join("\n");
  linhas.push("", "Estes testes ficam fora das fatias que bloqueiam e rodam aqui 3 vezes, com 1 worker e sem nova tentativa.", "", "| Item | Dono | Teste | Passou | Expira |", "|---|---|---|---|---|");
  for (const l of r.linhas) {
    const passou = l.rodou === 0 ? "não rodou" : `${l.passou} de ${l.rodou}`;
    const nota = l.vencida ? " — **vencida**" : l.rodou >= 3 && l.passou === l.rodou ? " — candidata a sair" : "";
    linhas.push(`| ${l.item} | ${l.dono} | ${l.spec} › ${String(l.titulo).replace(/\|/g, "\\|")} | ${passou} | ${l.expira}${nota} |`);
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
  const [comando, ...resto] = process.argv.slice(2);
  const hoje = new Date().toISOString().slice(0, 10);
  const entradas = lerQuarentena();
  if (comando === "padrao") {
    process.stdout.write(padraoDaQuarentena(entradas));
    return;
  }
  if (comando === "validar") {
    const erros = validarQuarentena(entradas, hoje, { specExiste: (s) => existsSync(`tests/e2e/specs/${s}`) });
    for (const e of erros) console.error(`::error::quarentena: ${e}`);
    console.log(`quarentena: ${entradas.length} de ${TETO} entradas, ${erros.length} erro(s)`);
    if (erros.length > 0) process.exit(1);
    return;
  }
  if (comando === "resumo") {
    const iSaida = resto.indexOf("--saida");
    const saida = iSaida >= 0 ? resto[iSaida + 1] : null;
    const [resultado] = resto.filter((a, i) => !a.startsWith("--") && resto[i - 1] !== "--saida");
    const r = resultadoDaQuarentena(entradas, lerJson(resultado), hoje);
    if (saida) writeFileSync(saida, JSON.stringify({ tamanho: r.tamanho, teto: r.teto, vencidas: r.vencidas.length, candidatas: r.candidatas.length, nao_rodaram: r.naoRodaram.length, linhas: r.linhas }));
    console.log(textoDaQuarentena(r));
    return;
  }
  console.error("uso: quarentena.mjs padrao | validar | resumo <resultado.json> [--saida quarentena.json]");
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}`) principal();
