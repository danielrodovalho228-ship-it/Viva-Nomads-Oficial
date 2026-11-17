/*
  Roda: node --test tests/laboratorio/e744-t4-noite-verde.test.ts
  E744, T4 (plano de 17/11): o consolidar calcula se a noite foi VERDE e grava o estado em lab_execucoes.

  Uma rodada é VERDE quando:
    - a completude fecha (executados + pulos declarados = listados; nada rodou fora da listagem);
    - há ZERO falhas fora de "conhecida" e de "quarentena";
    - há ZERO instáveis fora de "quarentena".
  As conhecidas e a quarentena aparecem sempre no resumo, com contagem. A meta é 3 noites verdes seguidas.

  Classes de um teste das fatias que bloqueiam:
    passou · pulou (de propósito) · conhecida (test.fail() que falhou como esperado; leva o item do defeito) ·
    instável (passou só na nova tentativa) · falhou. Dentro de "falhou", o que é de um spec sem disposição no arquivo
    tests/laboratorio/disposicao-falhas.json conta à parte como "sem disposição".
  A quarentena roda fora das fatias e não entra no veredito.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classesDaRodada, noiteVerde, sequenciaDeNoitesVerdes, textoDoRelatorio } from "../../scripts/lab/noite-verde.mjs";

type Caso = { titulo: string; status: string; esperado?: string; item?: string };
/** Relatório JSON do Playwright com os testes dados: status "expected" | "unexpected" | "flaky" | "skipped". */
const relatorio = (porSpec: Record<string, Caso[]>) => ({
  suites: Object.entries(porSpec).map(([spec, casos]) => ({
    title: spec,
    file: spec,
    specs: casos.map((c) => ({
      title: c.titulo,
      file: spec,
      tests: [{ projectName: "chromium", expectedStatus: c.esperado ?? "passed", status: c.status, annotations: c.item ? [{ type: "defeito", description: c.item }] : [], results: c.status === "skipped" ? [] : [{ status: "x" }] }],
    })),
  })),
});
const DISPOSICOES = [
  { spec: "t11-travessias.spec.ts", disposicao: "defeito", item: "E975" },
  { spec: "t38-varios-imoveis-por-dono.spec.ts", disposicao: "teste-velho" },
];
const COMPLETA = { listados: 100, executados: 97, nao_executados: 0, fora_da_listagem: 0 };
const QUARENTENA = { tamanho: 8, vencidas: 0, candidatas: 1, nao_rodaram: 0 };
const verde = () => relatorio({ "t1-home.spec.ts": [{ titulo: "a", status: "expected" }, { titulo: "b", status: "skipped", esperado: "skipped" }] });

// ---------- as classes ----------

test("classes: passou, pulou, conhecida (com o item), instável, falhou e sem disposição", () => {
  const c = classesDaRodada(
    relatorio({
      "t1-home.spec.ts": [{ titulo: "passa", status: "expected" }, { titulo: "pulo", status: "skipped", esperado: "skipped" }, { titulo: "oscila", status: "flaky" }],
      "t11-travessias.spec.ts": [{ titulo: "defeito marcado", status: "expected", esperado: "failed", item: "E975" }],
      "t38-varios-imoveis-por-dono.spec.ts": [{ titulo: "teste velho", status: "unexpected" }],
      "t999-novo.spec.ts": [{ titulo: "ninguém olhou", status: "unexpected" }],
    }),
    DISPOSICOES,
  );
  assert.deepEqual(
    { passou: c.passou, pulou: c.pulou, conhecida: c.conhecida, instavel: c.instavel, falhou: c.falhou, sem_disposicao: c.sem_disposicao },
    { passou: 1, pulou: 1, conhecida: 1, instavel: 1, falhou: 2, sem_disposicao: 1 },
  );
  assert.deepEqual(c.conhecidas_por_item, { E975: 1 });
  assert.deepEqual(c.specs_sem_disposicao, ["t999-novo.spec.ts"]);
});

test("conhecida sem a anotação do item aparece como 'sem item', não some", () => {
  const c = classesDaRodada(relatorio({ "t49-seguranca-publica.spec.ts": [{ titulo: "CSP", status: "expected", esperado: "failed" }] }), []);
  assert.equal(c.conhecida, 1);
  assert.deepEqual(c.conhecidas_por_item, { "sem item": 1 });
});

test("defeito corrigido com a marca ainda no teste: o Playwright dá 'unexpected' e conta como falhou", () => {
  const c = classesDaRodada(relatorio({ "t11-travessias.spec.ts": [{ titulo: "defeito marcado", status: "unexpected", esperado: "failed", item: "E975" }] }), DISPOSICOES);
  assert.deepEqual([c.falhou, c.conhecida, c.sem_disposicao], [1, 0, 0]);
});

test("teste que nunca começou (cadeia em série depois de uma falha) não é pulo nem falha: quem o acusa é a completude", () => {
  const c = classesDaRodada(relatorio({ "t1-home.spec.ts": [{ titulo: "não começou", status: "skipped" }] }), []);
  assert.deepEqual([c.passou, c.pulou, c.falhou, c.nao_iniciado], [0, 0, 0, 1]);
});

// ---------- o veredito ----------

test("verde: completude fechada, zero falhas e zero instáveis — com conhecidas e quarentena à vista", () => {
  const classes = classesDaRodada(relatorio({ "t1-home.spec.ts": [{ titulo: "a", status: "expected" }], "t11-travessias.spec.ts": [{ titulo: "d", status: "expected", esperado: "failed", item: "E975" }] }), DISPOSICOES);
  const n = noiteVerde({ classes, completude: COMPLETA, quarentena: QUARENTENA });
  assert.equal(n.estado, "verde");
  assert.deepEqual(n.motivos, []);
  assert.deepEqual(n.classes, { falhou: 0, conhecida: 1, quarentena: 8, instavel: 0, sem_disposicao: 0 });
});

test("vermelha por falha: uma só já basta, com ou sem disposição", () => {
  const com = noiteVerde({ classes: classesDaRodada(relatorio({ "t38-varios-imoveis-por-dono.spec.ts": [{ titulo: "x", status: "unexpected" }] }), DISPOSICOES), completude: COMPLETA, quarentena: QUARENTENA });
  assert.equal(com.estado, "vermelha");
  assert.match(com.motivos.join("\n"), /1 falha fora de "conhecida" e de "quarentena"/);
  const sem = noiteVerde({ classes: classesDaRodada(relatorio({ "t999-novo.spec.ts": [{ titulo: "x", status: "unexpected" }] }), DISPOSICOES), completude: COMPLETA, quarentena: QUARENTENA });
  assert.equal(sem.estado, "vermelha");
  assert.match(sem.motivos.join("\n"), /1 delas? sem disposição/);
});

test("vermelha por instável fora da quarentena", () => {
  const n = noiteVerde({ classes: classesDaRodada(relatorio({ "t1-home.spec.ts": [{ titulo: "oscila", status: "flaky" }] }), []), completude: COMPLETA, quarentena: QUARENTENA });
  assert.equal(n.estado, "vermelha");
  assert.match(n.motivos.join("\n"), /1 instável fora da quarentena/);
});

test("vermelha por completude: teste listado que não rodou, teste fora da listagem, ou rodada sem listagem", () => {
  const classes = classesDaRodada(verde(), []);
  const naoRodou = noiteVerde({ classes, completude: { ...COMPLETA, nao_executados: 3 }, quarentena: QUARENTENA });
  assert.equal(naoRodou.estado, "vermelha");
  assert.match(naoRodou.motivos.join("\n"), /completude não fechou: 3 listados não rodaram/);
  const fora = noiteVerde({ classes, completude: { ...COMPLETA, fora_da_listagem: 2 }, quarentena: QUARENTENA });
  assert.match(fora.motivos.join("\n"), /2 rodaram fora da listagem/);
  for (const c of [{}, null, { listados: 0, executados: 0, nao_executados: 0 }]) {
    const semLista = noiteVerde({ classes, completude: c as never, quarentena: QUARENTENA });
    assert.equal(semLista.estado, "vermelha");
    assert.match(semLista.motivos.join("\n"), /sem a listagem do commit/);
  }
});

test("a quarentena não muda o veredito: nem cheia, nem vencida, nem sem ter rodado — mas a contagem vai junto", () => {
  const classes = classesDaRodada(verde(), []);
  for (const q of [QUARENTENA, { tamanho: 25, vencidas: 3, candidatas: 0, nao_rodaram: 25 }, null]) {
    const n = noiteVerde({ classes, completude: COMPLETA, quarentena: q as never });
    assert.equal(n.estado, "verde");
    assert.equal(n.classes.quarentena, q?.tamanho ?? 0);
  }
});

test("os três motivos juntos aparecem os três", () => {
  const classes = classesDaRodada(relatorio({ "t1-home.spec.ts": [{ titulo: "f", status: "unexpected" }, { titulo: "i", status: "flaky" }] }), []);
  const n = noiteVerde({ classes, completude: { ...COMPLETA, nao_executados: 1 }, quarentena: QUARENTENA });
  assert.equal(n.motivos.length, 3);
});

// ---------- a sequência ----------

test("sequência: conta as noites AGENDADAS verdes seguidas, da mais nova para trás, e para na primeira vermelha", () => {
  assert.equal(sequenciaDeNoitesVerdes(["verde", "verde", "vermelha", "verde"]), 2);
  assert.equal(sequenciaDeNoitesVerdes(["vermelha", "verde", "verde"]), 0);
  assert.equal(sequenciaDeNoitesVerdes([]), 0);
  // Noite antiga, de antes da T4, não tem estado gravado: quebra a sequência (não se sabe se foi verde).
  assert.equal(sequenciaDeNoitesVerdes(["verde", null, "verde"]), 1);
});

test("sequência com a rodada de hoje: a agendada entra na conta; a manual não soma nem zera", () => {
  const antes = ["verde", "verde"];
  assert.equal(sequenciaDeNoitesVerdes(antes, { estado: "verde", gatilho: "schedule" }), 3);
  assert.equal(sequenciaDeNoitesVerdes(antes, { estado: "vermelha", gatilho: "schedule" }), 0);
  assert.equal(sequenciaDeNoitesVerdes(antes, { estado: "verde", gatilho: "workflow_dispatch" }), 2);
  assert.equal(sequenciaDeNoitesVerdes(antes, { estado: "vermelha", gatilho: "workflow_dispatch" }), 2);
});

// ---------- o relatório do dia ----------

test("o relatório diz o estado, as fatias completas, as falhas por classe, a quarentena, as conhecidas e a sequência", () => {
  const classes = classesDaRodada(
    relatorio({
      "t1-home.spec.ts": [{ titulo: "a", status: "expected" }, { titulo: "oscila", status: "flaky" }],
      "t11-travessias.spec.ts": [{ titulo: "d", status: "expected", esperado: "failed", item: "E975" }],
      "t999-novo.spec.ts": [{ titulo: "x", status: "unexpected" }],
    }),
    DISPOSICOES,
  );
  const noite = noiteVerde({ classes, completude: COMPLETA, quarentena: QUARENTENA });
  const texto = textoDoRelatorio({ noite, classes, completude: COMPLETA, quarentena: QUARENTENA, fatias: { completas: 19, esperadas: 20 }, sequencia: 0, gatilho: "schedule", data: "2026-11-18" });
  assert.match(texto, /## Relatório da noite — 2026-11-18: 🔴 VERMELHA/);
  assert.match(texto, /Fatias completas: 19 de 20/);
  assert.match(texto, /\| Falhou \| 1 \|/);
  assert.match(texto, /\| — das quais sem disposição \| 1 \|/);
  assert.match(texto, /\| Instável \(fora da quarentena\) \| 1 \|/);
  assert.match(texto, /\| Conhecida \(defeito com item\) \| 1 \|/);
  assert.match(texto, /\| Quarentena \| 8 de 25 \|/);
  assert.match(texto, /Conhecidas por item: E975 \(1\)/);
  assert.match(texto, /Sem disposição: t999-novo\.spec\.ts/);
  assert.match(texto, /Noites verdes seguidas: 0 \(meta: 3\)/);
  assert.match(texto, /Por que não é verde:/);
});

test("relatório de noite verde: diz VERDE, não lista motivos e mostra a sequência; a manual avisa que não conta", () => {
  const classes = classesDaRodada(verde(), []);
  const noite = noiteVerde({ classes, completude: COMPLETA, quarentena: QUARENTENA });
  const agendada = textoDoRelatorio({ noite, classes, completude: COMPLETA, quarentena: QUARENTENA, fatias: { completas: 20, esperadas: 20 }, sequencia: 3, gatilho: "schedule", data: "2026-11-20" });
  assert.match(agendada, /🟢 VERDE/);
  assert.doesNotMatch(agendada, /Por que não é verde/);
  assert.match(agendada, /Noites verdes seguidas: 3 \(meta: 3\) — meta atingida/);
  const manual = textoDoRelatorio({ noite, classes, completude: COMPLETA, quarentena: QUARENTENA, fatias: { completas: 20, esperadas: 20 }, sequencia: 2, gatilho: "workflow_dispatch", data: "2026-11-20" });
  assert.match(manual, /rodada manual: não conta para a sequência/);
});

// ---------- o workflow e o banco ----------

test("o consolidar calcula a noite, escreve o relatório no topo do resumo e grava o estado em lab_execucoes", () => {
  const yml = readFileSync(".github/workflows/laboratorio.yml", "utf8");
  const consolidar = yml.slice(yml.indexOf("\n  consolidar:"));
  assert.match(consolidar, /node scripts\/lab\/noite-verde\.mjs /);
  assert.match(consolidar, /--disposicoes tests\/laboratorio\/disposicao-falhas\.json/);
  assert.match(consolidar, /--quarentena tests\/laboratorio\/saida\/quarentena\.json/);
  assert.match(consolidar, /--completude tests\/laboratorio\/saida\/numeros\.json/);
  // O estado vai para a coluna nova, num comando à parte: se a coluna ainda não existe, a linha da rodada não se perde.
  assert.match(consolidar, /update public\.lab_execucoes set noite = :'noite'::jsonb/);
  assert.match(consolidar, /noite->>'estado'/, "a sequência lê o estado das noites agendadas anteriores");
  // O vermelho da rodada continua vindo das fatias, da completude e das regressões: a T4 só calcula e grava.
  assert.match(consolidar, /needs\.laboratorio\.result != 'success'/);
});

test("a migração 0345 cria a coluna noite e tem o aplicar de produção", () => {
  const sql = readFileSync("supabase/migrations/0345_lab_execucoes_noite.sql", "utf8");
  assert.match(sql, /alter table public\.lab_execucoes add column if not exists noite jsonb;/);
  const aplicar = readFileSync("supabase/producao/aplicar-0345.sql", "utf8");
  assert.match(aplicar, /^begin;/m);
  assert.match(aplicar, /^commit;/m);
  assert.match(aplicar, /add column if not exists noite jsonb;/);
  assert.match(aplicar, /'0345_lab_execucoes_noite'/);
});
