/*
  E744 (15/11/2026) — infra da suíte noturna fatiada: a rodada tem que poder ficar COMPLETA e o resumo tem que ser legível.

  1) Listagem estável. O job `construir` lista os testes do commit SEM a massa da varredura (o arquivo
     tests/laboratorio/saida/varredura.json só nasce no seed de cada fatia). O t337 montava a lista de testes a partir desse
     arquivo: 24 testes na listagem, 27 na fatia, com títulos diferentes. Resultado medido nas noturnas de 12, 13 e 14/11:
     4 "não executados" falsos em toda rodada e 3 testes rodando fora da conferência. A lista de testes de um spec não pode
     depender de arquivo nem de dado que só existe na fatia.
  2) Completude nos dois sentidos. Teste que RODOU e não está na listagem também reprova: é sinal de que listagem e rodada
     não falam do mesmo conjunto.
  3) Números por fatia no resumo: listados, executados, falhas e tempo de cada fatia (antes era preciso refazer o mapa à mão).

  Roda: node --test tests/laboratorio/e744-infra-da-suite.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { completude, textoCompletude } from "../../scripts/lab/conferir-completude.mjs";
import { numerosDaFatia, numerosPorFatia, textoPorFatia } from "../../scripts/lab/numeros-por-fatia.mjs";
import { MASSA_DE_LISTAGEM, PERSONAS_DA_REDUNDANCIA, gruposDaRedundancia, tituloDoGrupo } from "../e2e/fixtures/rotas-redundancia.ts";
import type { Massa } from "../e2e/fixtures/varredura.ts";

const yml = readFileSync(".github/workflows/laboratorio.yml", "utf8");
const t337 = readFileSync("tests/e2e/specs/t337-varredura-redundancia.spec.ts", "utf8");

/** Massa como a que o seed da fatia grava: ids de verdade (uuid), todos diferentes. */
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const MASSA_DA_FATIA: Massa = {
  ids: { DONO17: uuid(1), DONO0: uuid(2), INQUILINA: uuid(3), PARCEIRO: uuid(4), TRES: uuid(5) },
  imovel17: uuid(11),
  rascunho1: uuid(12),
  rascunho0: uuid(13),
  imovelTres: uuid(14),
  contrato: uuid(21),
  contratoTres: uuid(22),
  parceiro: uuid(31),
  parceiroTres: uuid(32),
};

const titulos = (m: Massa) =>
  PERSONAS_DA_REDUNDANCIA.flatMap((p) => gruposDaRedundancia(p, m).map((grupo, g) => tituloDoGrupo(p, g, grupo.length)));

test("E744 t337: a lista de testes (quantidade e títulos) é a mesma com a massa de listagem e com a massa da fatia", () => {
  const naListagem = titulos(MASSA_DE_LISTAGEM);
  const naFatia = titulos(MASSA_DA_FATIA);
  assert.ok(naListagem.length >= 20, `o t337 lista ${naListagem.length} testes`);
  assert.deepEqual(naListagem, naFatia);
  // As rotas com id entram na conta da listagem: sem elas a contagem de telas (e o título) mudava na fatia.
  const rotas = PERSONAS_DA_REDUNDANCIA.flatMap((p) => gruposDaRedundancia(p, MASSA_DE_LISTAGEM).flat());
  assert.ok(rotas.some((r) => r.startsWith("/dashboard/estadia/")), "a listagem conta as rotas com id");
  assert.equal(new Set(titulos(MASSA_DE_LISTAGEM)).size, naListagem.length, "títulos únicos");
});

test("E744 t337: o spec monta os testes pela massa de LISTAGEM e só usa a massa da fatia dentro do teste", () => {
  assert.match(t337, /gruposDaRedundancia\(persona, MASSA_DE_LISTAGEM\)/, "a lista sai da massa de listagem");
  assert.match(t337, /tituloDoGrupo\(persona, g, /, "o título vem da função única");
  // Nada de montar a lista com o arquivo da fatia: fora de um teste, a massa lida do disco não decide título nem quantidade.
  const antesDosTestes = t337.slice(0, t337.indexOf("test.describe("));
  assert.doesNotMatch(antesDosTestes, /rotasDe\(|COM_ID/, "a regra das rotas mora em fixtures/rotas-redundancia.ts");
  assert.match(t337, /sem a massa da varredura/, "sem a massa na fatia, o grupo com rota de id reprova dizendo o que falta, em vez de mudar de tamanho em silêncio");
});

type Teste = { status: string; expectedStatus: string; results: { status: string }[]; projectName?: string };
const tst = (status: string, expectedStatus: string, results: string[], projectName = "chromium"): Teste => ({
  status,
  expectedStatus,
  projectName,
  results: results.map((s) => ({ status: s })),
});
const relatorio = (specs: [string, Teste[]][], arquivo = "t1-a.spec.ts", stats: Record<string, unknown> = {}) => ({
  stats,
  suites: [
    {
      title: arquivo,
      file: arquivo,
      specs: [],
      suites: [{ title: "bloco", file: arquivo, specs: specs.map(([title, tests]) => ({ title, file: arquivo, tests })) }],
    },
  ],
});

test("E744 completude: teste que rodou FORA da listagem reprova e aparece no resumo", () => {
  const listagem = relatorio([
    ["inquilino 5: 3 telas", [tst("skipped", "passed", [])]],
    ["publico 1: 8 telas", [tst("skipped", "passed", [])]],
  ]);
  const rodada = relatorio([
    ["inquilino 5: 4 telas", [tst("expected", "passed", ["passed"])]],
    ["publico 1: 8 telas", [tst("expected", "passed", ["passed"])]],
  ]);
  const c = completude(listagem, rodada);
  assert.equal(c.ok, false);
  assert.deepEqual(c.naoExecutados, ["chromium › t1-a.spec.ts › bloco › inquilino 5: 3 telas"]);
  assert.deepEqual(c.foraDaListagem, ["chromium › t1-a.spec.ts › bloco › inquilino 5: 4 telas"]);
  const texto = textoCompletude(c);
  assert.match(texto, /fora da listagem 1/);
  assert.match(texto, /inquilino 5: 4 telas/);
  assert.match(texto, /a lista de testes de um spec não pode depender/i);
});

test("E744 completude: só o que rodou fora da listagem (sem nenhum não executado) também reprova", () => {
  const listagem = relatorio([["a", [tst("skipped", "passed", [])]]]);
  const rodada = relatorio([
    ["a", [tst("expected", "passed", ["passed"])]],
    ["b que ninguém listou", [tst("expected", "passed", ["passed"])]],
  ]);
  const c = completude(listagem, rodada);
  assert.equal(c.naoExecutados.length, 0);
  assert.equal(c.foraDaListagem.length, 1);
  assert.equal(c.ok, false);
});

test("E744 completude: rodada igual à listagem segue completa; pulo declarado fora da listagem não conta como executado", () => {
  const listagem = relatorio([["a", [tst("skipped", "passed", [])]]]);
  const rodada = relatorio([
    ["a", [tst("expected", "passed", ["passed"])]],
    ["pulado e não listado", [tst("skipped", "skipped", [])]],
  ]);
  const c = completude(listagem, rodada);
  assert.equal(c.ok, true);
  assert.deepEqual(c.foraDaListagem, []);
  assert.match(textoCompletude(c), /fora da listagem 0/);
});

test("E744 por fatia: listados, executados, passou, falhou, instável, pulos e não iniciados de UMA fatia", () => {
  const r = relatorio(
    [
      ["passa", [tst("expected", "passed", ["passed"])]],
      ["falha", [tst("unexpected", "passed", ["failed", "failed"])]],
      ["instável", [tst("flaky", "passed", ["failed", "passed"])]],
      ["pulado de propósito", [tst("skipped", "skipped", [])]],
      ["pulado dentro do teste", [tst("skipped", "skipped", ["skipped"])]],
      ["nunca começou (cadeia em série)", [tst("skipped", "passed", [])]],
      ["cortado pelo teto", [tst("skipped", "passed", ["skipped"])]],
      ["falha conhecida", [tst("expected", "failed", ["failed"])]],
    ],
    "t1-a.spec.ts",
    { startTime: "2026-11-14T13:20:00.000Z", duration: 1_446_000 },
  );
  assert.deepEqual(numerosDaFatia(r), {
    listados: 8,
    executados: 4,
    passou: 2,
    falhou: 1,
    instavel: 1,
    pulosDeclarados: 2,
    naoIniciados: 2,
    minutos: 24.1,
  });
});

test("E744 por fatia: lê a pasta dos artifacts, numera pela pasta e acusa a fatia que não entregou resultado", () => {
  const pasta = mkdtempSync(join(tmpdir(), "e744-fatias-"));
  const gravar = (n: number, r: unknown) => {
    const dir = join(pasta, `laboratorio-999-fatia-${n}`, "tests", "laboratorio", "saida");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "resultado.json"), JSON.stringify(r));
  };
  gravar(2, relatorio([["a", [tst("expected", "passed", ["passed"])]]], "t2.spec.ts", { duration: 60_000 }));
  gravar(10, relatorio([["b", [tst("unexpected", "passed", ["failed"])]]], "t10.spec.ts", { duration: 120_000 }));
  mkdirSync(join(pasta, "laboratorio-999-fatia-3"), { recursive: true }); // artifact sem resultado.json
  const linhas = numerosPorFatia(pasta, 4);
  assert.deepEqual(
    linhas.map((l) => [l.fatia, l.entregou]),
    [
      [1, false],
      [2, true],
      [3, false],
      [4, false],
      [10, true],
    ],
    "ordem numérica (2 antes de 10) e as esperadas que faltam aparecem",
  );
  const texto = textoPorFatia(linhas);
  assert.match(texto, /### Por fatia \(executados × listados\)/);
  assert.match(texto, /\| 2 \| 1 \| 1 \| 1 \| 0 \| 0 \| 0 \| 0 \| 1,0 \| verde \|/);
  assert.match(texto, /\| 10 \| 1 \| 1 \| 0 \| 1 \| 0 \| 0 \| 0 \| 2,0 \| vermelha \|/);
  assert.match(texto, /\| 3 \| — \| — \| — \| — \| — \| — \| — \| — \| sem resultado \|/);
  assert.match(texto, /\| \*\*Total\*\* \| 2 \| 2 \| 1 \| 1 \| 0 \| 0 \| 0 \|/);
});

test("E744 por fatia: fatia com teste não iniciado fica 'incompleta' mesmo sem falha", () => {
  const pasta = mkdtempSync(join(tmpdir(), "e744-fatias-"));
  const dir = join(pasta, "laboratorio-1-fatia-1");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "resultado.json"), JSON.stringify(relatorio([["cortado", [tst("skipped", "passed", [])]]])));
  assert.match(textoPorFatia(numerosPorFatia(pasta, 1)), /\| 1 \| 1 \| 0 \| 0 \| 0 \| 0 \| 0 \| 1 \| 0,0 \| incompleta \|/);
});

test("E744 workflow: o resumo da noite traz a tabela por fatia, com o mesmo número de fatias esperadas da junção", () => {
  const consolidar = yml.split("  consolidar:")[1] ?? "";
  const esperadasJuncao = /juntar-resultados\.mjs fatias \S+ --esperadas (\d+)/.exec(consolidar)?.[1];
  const esperadasFatia = /numeros-por-fatia\.mjs fatias --esperadas (\d+)/.exec(consolidar)?.[1];
  assert.ok(esperadasFatia, "o consolidar chama numeros-por-fatia.mjs");
  assert.equal(esperadasFatia, esperadasJuncao);
  const resumo = consolidar.slice(consolidar.indexOf("- name: Resumo da noite"), consolidar.indexOf("- name: Registrar no banco"));
  assert.match(resumo, /numeros-por-fatia\.mjs/, "a tabela por fatia entra no resumo da rodada");
  assert.match(resumo, /GITHUB_STEP_SUMMARY/);
});
